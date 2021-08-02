module.exports = (cnf, deps) => {
  // 这一行代码是为了避免eslint错误, 真实项目不需要保留
  console.warn("After hook: %s", Object.keys(deps));
  // TODO
  // Before hook 是整理主模块需要的初始化参数的，如果没有特殊要处理的，可以不需要
  // Before hook 如果要存在，则必须返回一个数组，改数组是主模块初始化时的实际参数
  return [cnf, deps];
};
