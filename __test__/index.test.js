const async = require("async");
const MCenter = require("..");

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
  const mcenter = MCenter(cnf, deps);
  it("regist, case1", async () => {
    const validator = jest.fn();
    const types = [
      {
        type: "save",
        timeout: 30,
        validator: jest.fn(),
      },
    ];
    expect(mcenter.regist("test", validator, types)).toBe(1);
  });

  it("regist, case2", async () => {
    const validator = jest.fn();
    const types = [
      {
        type: "save",
        timeout: 20,
      },
    ];
    expect(mcenter.regist("test2", validator, types)).toBe(2);
  });

  it("regist, case3", async () => {
    const validator = jest.fn();
    const types = [
      {
        type: "save",
      },
    ];
    expect(mcenter.regist("test3", validator, types)).toBe(3);
  });

  it("regist, case4", async () => {
    const types = [
      {
        type: "save",
      },
    ];
    expect(mcenter.regist("test4", null, types)).toBe(4);
  });

  it("regist, duplicate error", async () => {
    const types = [
      {
        type: "save",
      },
    ];
    expect(() => mcenter.regist("test4", null, types)).toThrow("has been registed");
  });

  it("publish, case1", async () => {
    const callback = jest.fn();
    mcenter.publish("test", { name: "redstone" }, callback);
  });

  it("publish, case2", async () => {
    const callback = jest.fn();
    mcenter.publish("test2", { name: "redstone1" }, callback);
  });
});
