const _ = require("lodash");
const async = require("async");
const MCenter = require("..");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);
process.on("rejectionHandled", console.error);

const sleep = (MS = 1000) =>
  new Promise((resolve) => {
    setTimeout(resolve, MS);
  });

describe("MCenter", () => {
  const cnf = {
    mcenter: {
      maxListeners: 2,
      hash: { key: "mcenter-store" },
    },
  };
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  };
  const tryCatchLog = jest.fn((fn) => fn);

  const listeners = {
    testSave: jest.fn(async () => {
      await sleep(300);
      return { value: "testSave" };
    }),
    testCleanCache: jest.fn(async () => {
      await sleep(300);
      return { value: "cleanCache" };
    }),
    test2Save: jest.fn(async () => {
      await sleep(300);
      return { value: "test2Save" };
    }),
    test3Save: jest.fn(async () => {
      await sleep(300);
      return { value: "test3Save" };
    }),
    test4Save: jest.fn(async () => {
      await sleep(300);
      return { value: "test4Save" };
    }),
    test4UpdateCache: jest.fn(async () => {
      await sleep(300);
      return { value: "test4UpdateCache" };
    }),
  };

  const publishValidators = {
    test: jest.fn(),
    test2: jest.fn(),
    test3: jest.fn(),
    test4: jest.fn(),
  };

  const listenerValidators = {
    test: jest.fn(),
  };

  describe("have to recover", () => {
    const graceful = {
      exit: jest.fn(),
    };
    const redis = {
      hset: jest.fn(),
      hdel: jest.fn(),
      hgetall: jest.fn(),
    };
    const deps = {
      _,
      async,
      logger,
      redis,
      graceful,
      U: { tryCatchLog },
    };
    const mcenter = MCenter(cnf, deps);

    it("regist", async () => {
      const types = [
        {
          type: "save",
          timeout: 30,
          validator: listenerValidators.test,
        },
        {
          type: "cleanCache",
          timeout: 30,
        },
      ];
      expect(mcenter.regist("test", publishValidators.test, types)).toBe(1);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("subscribe", async () => {
      mcenter.subscribe("test", "save", listeners.testSave);
      mcenter.subscribe("test", "cleanCache", listeners.testCleanCache);
      expect(mcenter.checkReady()).toBe(true);
      await sleep(500);
    });

    it("mulit publish and graceful.exit", async () => {
      _.times(3, (index) => {
        mcenter.publish("test", { name: "stonephp", index });
      });

      await sleep(500);
      expect(graceful.exit.mock.calls.length).toBe(1);
      const [exit] = graceful.exit.mock.calls.pop();
      exit();
      expect(mcenter.isExited()).toBe(false);
      expect(mcenter.isExiting()).toBe(true);
      await sleep(1000);
      expect(mcenter.isExited()).toBe(true);
      expect(mcenter.isExiting()).toBe(false);

      expect(redis.hset.mock.calls.length).toBe(1);
      const [redisKey, id, value] = redis.hset.mock.calls.pop();
      expect(redisKey).toBe("mcenter-store");
      expect(id.length).toBe(36);
      expect(value).toBe(
        JSON.stringify({ id, name: "test", data: { name: "stonephp", index: 2 }, result: {} }),
      );
    });
  });

  describe("exit when queue is empty", () => {
    const graceful = {
      exit: jest.fn(),
    };
    const redis = {
      hset: jest.fn(),
      hdel: jest.fn(),
      hgetall: jest.fn(),
    };
    const deps = {
      _,
      async,
      logger,
      redis,
      graceful,
      U: { tryCatchLog },
    };
    const mcenter = MCenter(cnf, deps);

    it("graceful.exit queue is empty", async () => {
      expect(graceful.exit.mock.calls.length).toBe(1);
      const [exit] = graceful.exit.mock.calls.pop();
      exit();
      expect(mcenter.isExited()).toBe(true);
      expect(mcenter.isExiting()).toBe(false);

      expect(redis.hset.mock.calls.length).toBe(0);
    });
  });
});
