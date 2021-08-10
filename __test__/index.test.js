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
  const deps = {
    async,
    logger: {
      info: jest.fn(),
      error: jest.fn(),
    },
    redis: {
      hset: jest.fn(),
      hdel: jest.fn(),
      hgetall: jest.fn(),
    },
    graceful: {
      exit: jest.fn(),
    },
    U: { tryCatchLog: jest.fn((fn) => fn) },
  };

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

  const errorFn = jest.fn();
  const timeoutFn = jest.fn();

  describe("no recover", () => {
    const mcenter = MCenter(cnf, deps);
    mcenter.setFn("timeout", timeoutFn);
    mcenter.setFn("error", errorFn);

    it("regist, case1", async () => {
      const types = [
        {
          type: "save",
          timeout: 30,
          validator: jest.fn(),
        },
      ];
      expect(mcenter.regist("test", publishValidators.test, types)).toBe(1);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("regist, case2", async () => {
      const validator = jest.fn();
      const types = [
        {
          type: "save",
          timeout: 20,
        },
      ];
      expect(mcenter.regist("test2", publishValidators.test2, types)).toBe(2);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("regist, case3", async () => {
      const types = [
        {
          type: "save",
        },
      ];
      expect(mcenter.regist("test3", publishValidators.test3, types)).toBe(3);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("regist, case4", async () => {
      const types = [
        {
          type: "save",
        },
        {
          type: "updateCache",
        },
      ];
      expect(mcenter.regist("test4", null, types)).toBe(4);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("regist, duplicate error", async () => {
      const types = [
        {
          type: "save",
        },
      ];
      expect(() => mcenter.regist("test4", null, types)).toThrow("has been registed");
      expect(mcenter.checkReady()).toBe(false);
    });

    it("publish, case1", async () => {
      mcenter.publish("test", { name: "redstone" }, callbacks.test);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("publish, case2", async () => {
      mcenter.publish("test2", { name: "redstone1" }, callbacks.test2);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("publish, case3", async () => {
      mcenter.publish("test3", { name: "redstone1" }, callbacks.test3);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("publish, case4", async () => {
      mcenter.publish("test4", { name: "redstone1" }, callbacks.test4);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("publish, case5", async () => {
      expect(() => mcenter.publish("test1", { name: "redstone1" }, callbacks.test3)).toThrow(
        "has not been registed",
      );
      expect(mcenter.checkReady()).toBe(false);
    });

    it("subscribe, case1", async () => {
      mcenter.subscribe("test", "save", listeners.testSave);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("subscribe, case2", async () => {
      mcenter.subscribe("test2", "save", listeners.test2Save);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("subscribe, case3", async () => {
      mcenter.subscribe("test3", "save", listeners.test3Save);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("subscribe, case4", async () => {
      mcenter.subscribe("test4", "save", listeners.test4Save);
      expect(mcenter.checkReady()).toBe(false);
    });

    it("subscribe, faild case", async () => {
      expect(() => mcenter.subscribe("test5", "save", listeners.test4Save)).toThrow(
        "has not been registed",
      );
      expect(mcenter.checkReady()).toBe(false);
    });

    it("subscribe, faild case2", async () => {
      expect(() => mcenter.subscribe("test4", "create", listeners.test4Save)).toThrow(
        "subscribe type unknown",
      );
      expect(mcenter.checkReady()).toBe(false);
    });

    it("subscribe, faild case3", async () => {
      expect(() => mcenter.subscribe("test4", "save", listeners.test4Save)).toThrow(
        "subscribe type duplicate",
      );
      expect(mcenter.checkReady()).toBe(false);
    });

    it("subscribe, case5", async () => {
      // 这个 subscibe 之后, 前面publish的消息会被分发执行
      mcenter.subscribe("test4", "updateCache", listeners.test4UpdateCache);
      expect(mcenter.checkReady()).toBe(true);
      expect(listeners.testSave.mock.calls.length).toBe(0);
      expect(listeners.test2Save.mock.calls.length).toBe(0);
      expect(listeners.test3Save.mock.calls.length).toBe(0);
      expect(listeners.test4Save.mock.calls.length).toBe(0);
      expect(listeners.test4UpdateCache.mock.calls.length).toBe(0);
      await sleep(700);
    });

    // 验证订阅的函数是否正确执行
    it("dispatch exec assert, subscribe listener check", async () => {
      expect(listeners.testSave.mock.calls.length).toBe(1);
      expect(listeners.testSave.mock.calls.pop()).toEqual([{ name: "redstone" }]);
      expect(listeners.test2Save.mock.calls.length).toBe(1);
      expect(listeners.test2Save.mock.calls.pop()).toEqual([{ name: "redstone1" }]);
      expect(listeners.test3Save.mock.calls.length).toBe(1);
      expect(listeners.test3Save.mock.calls.pop()).toEqual([{ name: "redstone1" }]);
      expect(listeners.test4Save.mock.calls.length).toBe(1);
      expect(listeners.test4Save.mock.calls.pop()).toEqual([{ name: "redstone1" }]);
      expect(listeners.test4UpdateCache.mock.calls.length).toBe(1);
      expect(listeners.test4UpdateCache.mock.calls.pop()).toEqual([{ name: "redstone1" }]);
    });

    // 验证publish的回调是否正常执行
    it("dispatch exec assert, publish callback check", async () => {
      (() => {
        expect(callbacks.test.mock.calls.length).toBe(1);
        const {
          save: [err, result, consumedMS],
        } = callbacks.test.mock.calls.pop()[0];
        expect(err).toBe(null);
        expect(result).toEqual({ value: "testSave" });
        expect(consumedMS).toBeGreaterThan(290);
      })();

      (() => {
        expect(callbacks.test2.mock.calls.length).toBe(1);
        const {
          save: [err, result, consumedMS],
        } = callbacks.test2.mock.calls.pop()[0];
        expect(err).toBe(null);
        expect(result).toEqual({ value: "test2Save" });
        expect(consumedMS).toBeGreaterThan(290);
      })();

      (() => {
        expect(callbacks.test3.mock.calls.length).toBe(1);
        const {
          save: [err, result, consumedMS],
        } = callbacks.test3.mock.calls.pop()[0];
        expect(err).toBe(null);
        expect(result).toEqual({ value: "test3Save" });
        expect(consumedMS).toBeGreaterThan(290);
      })();

      (() => {
        expect(callbacks.test4.mock.calls.length).toBe(1);
        const {
          save: [err, result, consumedMS],
          updateCache: [err2, result2, consumedMS2],
        } = callbacks.test4.mock.calls.pop()[0];
        expect(err).toBe(null);
        expect(result).toEqual({ value: "test4Save" });
        expect(consumedMS).toBeGreaterThan(290);

        expect(err2).toBe(null);
        expect(result2).toEqual({ value: "test4UpdateCache" });
        expect(consumedMS2).toBeGreaterThan(290);
      })();
    });

    it("dispatch exec assert, setFn call check", async () => {
      // 验证超时函数是否正确执行
      expect(timeoutFn.mock.calls.length).toBe(2);
      (() => {
        const [consumedMS, id, name, type] = timeoutFn.mock.calls.pop();
        expect(consumedMS).toBeGreaterThan(290);
        expect(id.length).toBe(36);
        expect(name).toBe("test2");
        expect(type).toBe("save");
      })();

      (() => {
        const [consumedMS, id, name, type] = timeoutFn.mock.calls.pop();
        expect(consumedMS).toBeGreaterThan(290);
        expect(id.length).toBe(36);
        expect(name).toBe("test");
        expect(type).toBe("save");
      })();
    });

    it("registed failed when mcenter been ready", async () => {
      expect(() => mcenter.regist("createEmployee", null, [{ type: "updateCache" }])).toThrow(
        "dont registed",
      );
    });

    it("setFn faild", async () => {
      expect(() => mcenter.setFn("test", console.log)).toThrow("unknown type: test");
    });

    it("dispatch exec listener function faild", async () => {
      listeners.testSave.mockRejectedValueOnce(Error("has error"));
      mcenter.publish("test", { name: "happen error" });
      await sleep(10);
      expect(listeners.testSave.mock.calls.length).toBe(1);
      expect(listeners.testSave.mock.calls.pop()).toEqual([{ name: "happen error" }]);

      expect(errorFn.mock.calls.length).toBe(1);
      const [err, id, name, type, data] = errorFn.mock.calls.pop();
      expect(err.message).toBe("has error");
      expect(id.length).toBe(36);
      expect(name).toBe("test");
      expect(type).toBe("save");
      expect(data).toEqual({ name: "happen error" });
    });
  });

  describe("have to recover", () => {
    const mcenter = MCenter(cnf, deps);
    mcenter.regist;
  });
});
