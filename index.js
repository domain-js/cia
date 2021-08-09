const uuid = require("uuid").v4;
const Errors = require("./errors");

function Main(cnf, deps) {
  const {
    logger,
    redis,
    graceful,
    U: { tryCatchLog },
  } = deps;

  const { mcenter } = cnf;

  const maxListeners = Math.max(1, ((mcenter && mcenter.maxListeners) || 10) | 0);
  const storeHashKey = (mcenter && mcenter.hash && mcenter.hash.key) || "mcenter";
  const { async } = deps;

  const errors = Errors(cnf, deps);
  // 默认通知函数
  const fns = {
    error: logger.error,
    timeout: logger.info,
  };
  // 记录已注册的消息
  // { [name]: { validator, types } };
  // name: String 消息名称
  // validator?: Function 消息体数据格式验证函数
  // types: [{
  //    type: 'updateUser', // 类型名称
  //    timeout?: 100, // 执行超时限定, 单位毫秒，可选 默认为 0, 不限制
  //    validator?: fn, // 返回值格式验证函数, 可选
  // }]
  const registed = {};

  // 记录监听回调函数
  // { [${name}::${type}]: { [type]: fn } }
  const listeners = new Map();

  let exiting = false;
  let exitingCount = 0;
  let readyToExitFn = null;

  // 利用redis 来存储未执行，或未完全执行的数据
  const store = async (item) => {
    exitingCount += 1;
    await redis.hset(storeHashKey, item.id, JSON.stringify(item));
    exitingCount -= 1;
    if (exitingCount === 0) readyToExitFn();
  };

  // 消息分发函数，分发到对应的订阅函数上
  const dispatch = async (item) => {
    const { id, name, data, result = {}, callback } = item;

    const { types } = registed[name];
    const withouts = new Set(Object.keys(result));

    await async.mapSeries(types, async ({ type, timeout, validator }) => {
      // 看看是否有设置要忽略掉某些订阅者
      // 这个功能主要是留给应用无故中断后系统自动恢复的任务执行
      if (withouts && withouts.has(type)) return;
      if (exiting) return;

      const fn = listeners.get(`${name}::${type}`);
      const startAt = Date.now();
      let err = null;
      let ret = null;
      try {
        ret = await fn(data);
        if (validator) validator(ret);
      } catch (e) {
        fns.error(e, name, type, data);
        err = e;
      }
      const consumedMS = Date.now() - startAt;
      if (timeout && timeout < consumedMS) fns.timeout(consumedMS, id, name, type, data);
      result[type] = [err, ret, consumedMS];

      // 记录执行结果
      logger.info(`MCenter.dispatch\t${id}\t${type}`, result[type]);
    });

    // 正在退出，且完成的不等于总共的，则需要储存, 以备下次启动后执行
    if (exiting && Object.keys(result).length !== types.length) {
      item.result = result;
      store(item);
    } else if (callback) {
      callback(result);
    }
  };

  // 内部消息队列
  const queue = async.queue(dispatch, maxListeners);
  graceful.exit(() => {
    exiting = true;

    return new Promise((resolve) => {
      readyToExitFn = resolve;
    });
  });

  // 恢复上次残留的消息订阅执行
  const recover = async () => {
    const items = await redis.hgetall(storeHashKey);
    for await (const id of Object.keys(items)) {
      const item = items[id];
      const ok = await redis.hdel(storeHashKey, id);
      if (ok !== 1) continue;
      try {
        queue.push(JSON.parse(item));
      } catch (e) {
        logger.error(e);
      }
    }
  };

  // regist 消息注册，提前注册好需要publish和subscribe的消息
  // 这么做的目的是可以随时检测是否所有的消息都消费者，消费者类型是否正确
  // 同时在publish的时候也可以检测发送的数据是否符合规定的格式
  const regist = (name, validator, types) => {
    if (registed[name]) throw errors.duplicatRegistMessage(name);
    registed[name] = { validator, types, typeNames: new Set(types.map((x) => x.type)) };

    return Object.keys(registed).length;
  };

  // subscribe 消息订阅
  const subscribe = (name, type, listener) => {
    if (!registed[name]) throw errors.subscribeUnregistedMessage(name);
    const { typeNames } = registed[name];
    if (!typeNames.has(type)) throw errors.subscribeUnknowTypes(name, type);

    const key = `${name}::${type}`;
    if (listeners.get(key)) throw errors.subscribeDuplicateType(name, type);

    listeners.set(key, listener);
  };

  // publish 消息发布
  // name string 消息名称
  // data any 消息数据
  // callback function 消息执行完毕回调
  const publish = (name, data, callback) => {
    if (!registed[name]) throw errors.publishUnregistedMessage(name);
    const { validator } = registed[name];
    if (validator) validator(data);
    const id = uuid();
    queue.push({ id, name, data, callback });
    logger.info(`MCenter.publish\t${id}`, { name, data });
  };

  // 设置通知函数，错误通知，超时通知
  // 在消息分发执行的时候遇到错误会调用错误通知函数
  // 在消息分发执行的时候遇到超时会调用超时通知函数
  // type string 类型，error or timeout
  // fn function 通知函数
  const setFn = (type, fn) => {
    if (!fns[type]) throw errors.setFnNotAllowed(type);
    // 这里之所以会用 tryCatchLog 封装函数，是不想让这些函数的执行影响主流程
    // 这些函数内部抛出的异常不会导致主流程执行中断
    fns[type] = tryCatchLog(fn, logger.error);
  };

  // check 消息注册、监听检测
  // 检查是否存在注册了的消息，但没有人监听消费
  const check = () => {
    const result = [];
    for (const name of Object.keys(registed)) {
      for (const type of registed[name]) {
        if (listeners.get(`${name}::${type.type}`)) continue;
        result.push([name, type.type]);
      }
    }

    return result;
  };

  return { regist, check, subscribe, publish, setFn, recover };
}

Main.Deps = ["async", "logger", "utils", "redis"];

module.exports = Main;
