module.exports = () =>
  Object.freeze({
    duplicatRegistMessage(name) {
      return Error(`The message has be registed: ${name}`);
    },
    publishUnregistedMessage(name) {
      return Error(`The message has not be registed: ${name}, when will publish`);
    },
    subscribeUnregistedMessage(name) {
      return Error(`The message has not be registed: ${name}, when will subscribe`);
    },
    subscribeUnknowTypes(name, type) {
      return Error(
        `The message subscribe type unknown, message name is: ${name}, type is: ${type}, when will subscribe`,
      );
    },
    setFnNotAllowed(type) {
      return Error(`Set function but unknow type: ${type}`);
    },
  });
