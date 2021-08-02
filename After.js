module.exports = (main, cnf, deps) => {
  // 这一行代码是为了避免eslint错误, 真实项目不需要保留
  console.warn("After hook: %s", Object.keys(deps));
  // TODO
  // After hook 是对主模块初始之后返回的对象进项二次加工
  // 第一个参数是主模块初始化之后的对象，后边的参数和主模块初始化参数保持一致
  // After hook 无须返回
};
