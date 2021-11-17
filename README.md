# @domain.js/cia

[![Build status](https://travis-ci.com/domain-js/cia.svg?branch=master)](https://travis-ci.org/domain-js/cia)
[![codecov](https://codecov.io/gh/domain-js/cia/branch/master/graph/badge.svg)](https://codecov.io/gh/domain-js/cia)

# Installation
<pre>npm i @domain.js/cia --save</pre>

# cnf
专属配置名称 `cia`
| 名称 | 类型 | 必填 | 默认值 | 描述 | 样例 |
| ---- | ---- | ---- | ------ | ---- | ---- |
| concurrency | int | No | 10 | task exec concurrency | 10 |
| storeKey | string | No | cia-store | redis storage hash key | cia-store |

# deps
| 模块名 | 别名 | 用到的方法 | 描述 |
| ------ | ---- | ---------- | ---- |
| logger | None | info, error | domain.js/logger |
| utils | U | tryCatchLog | utils functions |
| redis | None | hset, hdel, hgetall | domain.js/redis | 
| graceful | None | exit | domain.js/graceful | 


# Usage

## `regist`
注册消息到系统，提前注册的好处是可以预知有那些消息，都需要什么样的订阅者
* `eventName` string 必填 消息名称
* `validator` function 可选 消息数据验证函数
* `types` [Object]
  * `type` string 必填 订阅者类型名称
  * `timeout` integer 可选 订阅函数执行的超时限定, 单位毫秒，超时也不会中断，只是会触发一次超时函数的执行
  * `validator` function 可选，订阅函数返回值验证函数，校验失败直接抛出异常

```javascript
cia.regist('eventName', submitValidatorFunction, [
  {
    type: 'cleanCache', // 必填 订阅的名称
    timeout: 1000, // 可选 
  }
]);
```

## `link`
连接cia系统，通过waiter来接收对应的消息
* `eventName` string 必填 消息名称
* `type` string 必填 接待者类型，要和 regist types里的type匹配
* `waiter` function 必填 订阅函数

```javascript
cia.link('eventName', 'cleanCache', waiter);
```

## `submit`
提交函数，当有消息产生的时候通过改函数提交上去
* `eventName` string 必填 消息名称
* `data` any 必填 消息体数据

## `setFn`
设置超时函数和执行订阅错误接收函数, 不设置的时候默认是 logger.info 和 logger.error
* `type` string 必填 函数类型，`timeout` 或 `error`
* `function` function 必填 设置的函数

## `checkReady` 
检测系统是否已准备好，返回 `ture` 或 `false`

## `isExiting`
获取系统是否正在退出中，返回 `true` 或 `false`

## `isExited`
获取系统是否已退出，返回 `true` 或 `false`

## `getUnlinks`
获取未被 link 的消息任务, 排查问题的时候需要用到
