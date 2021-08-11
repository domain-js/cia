const uuid = require("uuid").v4;
const Errors = require("./errors");

function Main(cnf, deps) {
  const {
    _,
    logger,
    redis,
    graceful,
    U: { tryCatchLog },
  } = deps;

  const { mcenter } = cnf;

  const maxListeners = Math.max(1, ((mcenter && mcenter.maxListeners) || 10) | 0);
  const storeKey = (mcenter && mcenter.storeKey) || "mcenter";
  const { async } = deps;

  const errors = Errors(cnf, deps);

  let doingCount = 0; // 正在执行的消息数量
  let exited = false; // 是否已经完成退出
  let exiting = false; // 是否正在退出
  let storeCount = 0; // 退出时store操作计数器
  let readyToExitFn = null; // 完成退出前准备后执行函数
  let unsubscribedCount = 0; // 未被订阅的数量, 基于 {name}::{type} 判断
  let isReady = false; // 系统是否已准备妥当

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

  // 默认通知函数
  const fns = {
    error: logger.error,
    timeout: logger.info,
  };

  // 记录监听回调函数
  // { [${name}::${type}]: { [type]: fn } }
  const listeners = new Map();

  // 消息分发函数，分发到对应的订阅函数上
  const dispatch = async (item) => {
    const { id, name, data, result = {}, callback } = item;

    const { types } = registed[name];
    const withouts = new Set(Object.keys(result));

    doingCount += 1;
    await async.eachSeries(types, async ({ type, timeout, validator }) => {
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
        fns.error(e, id, name, type, data);
        err = e;
      }
      const consumedMS = Date.now() - startAt;
      if (timeout && timeout < consumedMS) fns.timeout(consumedMS, id, name, type);
      result[type] = [err, ret, consumedMS];

      // 记录执行结果
      logger.info(`MCenter.dispatch\t${id}\t${type}`, result[type]);
    });
    doingCount -= 1;

    // publish 设置了callback 要记得执行回调函数
    if (callback) callback(result);

    // 正在退出，且完成的不等于总共的，则需要储存, 以备下次启动后执行
    if (exiting) {
      if (Object.keys(result).length !== types.length) {
        item.result = result;
        // 存储以备下次启动恢复执行
        await redis.hset(storeKey, item.id, JSON.stringify(item));
      }
      // 全部处理完毕后，执行退出
      if (!doingCount) {
        exited = true;
        exiting = false;
        readyToExitFn();
      }
    }
  };

  // 内部消息队列, 初始化后立即暂定，等待 regist, subscribe 都准备好了在开始执行
  // 这样就不会有未成功订阅函数执行遗漏的问题了
  // 例如: A 函数要监听 1 好消息的 save 类型，结果在完成订阅前，已经有某个区域 publish 了 1 号事件
  //       如果队列一开始不暂停就会出现A函数遗漏执行
  const queue = async.queue(dispatch, maxListeners);
  queue.pause();

  graceful.exit(() => {
    exiting = true;

    return new Promise((resolve) => {
      // 如果队列已经清空，且没有正在执行的消息，则直接退出
      if (!queue.length() && !doingCount) {
        exited = true;
        exiting = false;
        resolve();
      } else {
        readyToExitFn = resolve;
      }
    });
  });

  // 恢复上次残留的消息订阅执行
  const recover = async () => {
    const items = await redis.hgetall(storeKey);
    if (!items) return;
    for await (const id of Object.keys(items)) {
      const item = items[id];
      const ok = await redis.hdel(storeKey, id);
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
    if (isReady) throw errors.registWhenReadyAfter(name);
    if (registed[name]) throw errors.duplicatRegistMessage(name);
    const typeNames = new Set(_.map(types, "type"));
    const item = { validator, types, typeNames };

    unsubscribedCount += typeNames.size;
    registed[name] = item;

    return Object.keys(registed).length;
  };

  // start 启动系统执行, 这之前一定要regist 和 subscribe 都准备好
  const start = async () => {
    queue.resume();
    await recover();
  };

  // check 消息注册、监听检测
  // 检查是否存在注册了的消息，但没有人监听消费
  const checkReady = () => {
    if (unsubscribedCount !== 0) return false;
    if (!isReady) {
      isReady = true;
      start();
    }
    return true;
  };

  // subscribe 消息订阅
  const subscribe = (name, type, listener) => {
    if (!registed[name]) throw errors.subscribeUnregistedMessage(name);
    const { typeNames } = registed[name];
    if (!typeNames.has(type)) throw errors.subscribeUnknowTypes(name, type);

    if (!_.isFunction(listener)) throw errors.subscribeListernerMustBeFunctionType(name, type);

    const key = `${name}::${type}`;
    if (listeners.get(key)) throw errors.subscribeDuplicateType(name, type);
    listeners.set(key, listener);

    unsubscribedCount -= 1;
    checkReady();
  };

  // publish 消息发布
  // name string 消息名称
  // data any 消息数据
  // callback function 消息执行完毕回调
  const publish = (name, data, callback) => {
    if (!registed[name]) throw errors.publishUnregistedMessage(name);
    if (callback && !_.isFunction(callback)) callback = undefined;
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

  // 进程是否正在退出
  const isExiting = () => Boolean(exiting);

  // 进程是否已经退出
  const isExited = () => Boolean(exited);

  return { isExiting, isExited, regist, checkReady, subscribe, publish, setFn };
}

Main.Deps = ["_", "async", "logger", "utils", "redis"];

module.exports = Main;
