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
      maxListeners: 10,
      hash: { key: "mcenter-store" },
    },
  };
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  };
  const graceful = {
    exit: jest.fn(),
  };
  const tryCatchLog = jest.fn((fn) => fn);

  const callbacks = {
    test: jest.fn(),
    test2: jest.fn(),
    test3: jest.fn(),
    test4: jest.fn(),
  };

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
    redis.hgetall.mockResolvedValueOnce({
      message_uuid: JSON.stringify({
        id: "message uuid",
        name: "test",
        data: { name: "recover message" },
        result: {
          save: [null, { value: "testSave" }, 301],
        },
      }),
      message_uuid2: JSON.stringify({
        id: "message uuid2",
        name: "test",
        data: { name: "recover message" },
      }),
      message_uuid3: "hello world",
    });
    redis.hdel.mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(1);

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

    it("recover check", async () => {
      expect(listeners.testCleanCache.mock.calls.length).toBe(1);
      expect(listeners.testCleanCache.mock.calls.pop()).toEqual([{ name: "recover message" }]);

      expect(listeners.testSave.mock.calls.length).toBe(0);

      expect(logger.error.mock.calls.length).toBe(1);
    });
  });
});
