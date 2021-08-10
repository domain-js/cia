module.exports = () =>
  Object.freeze({
    duplicatRegistMessage(name) {
      return Error(`The message has been registed: ${name}`);
    },
    registWhenReadyAfter(name) {
      return Error(`The message dont registed when mcenter be ready after: ${name}`);
    },
    publishUnregistedMessage(name) {
      return Error(`The message has not been registed: ${name}, when will publish`);
    },
    subscribeUnregistedMessage(name) {
      return Error(`The message has not been registed: ${name}, when will subscribe`);
    },
    subscribeUnknowTypes(name, type) {
      return Error(
        `The message subscribe type unknown, message name is: ${name}, type is: ${type}, when will subscribe`,
      );
    },
    subscribeDuplicateType(name, type) {
      return Error(
        `The message subscribe type duplicate, message name is: ${name}, type is: ${type}, when will subscribe`,
      );
    },
    subscribeListernerMustBeFunctionType(name, type) {
      return Error(
        `The message subscribe listener must be a function, message name is: ${name}, type is: ${type}, when will subscribe`,
      );
    },
    setFnNotAllowed(type) {
      return Error(`Set function but unknown type: ${type}`);
    },
  });
