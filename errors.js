module.exports = () =>
  Object.freeze({
    duplicatRegistMessage(name) {
      return Error(`The message has been registed: ${name}`);
    },
    registWhenReadyAfter(name) {
      return Error(`The message dont registed when mcenter be ready after: ${name}`);
    },
    submitUnregistedMessage(name) {
      return Error(`The message has not been registed: ${name}, when will submit`);
    },
    linkUnregistedMessage(name) {
      return Error(`The message has not been registed: ${name}, when will link`);
    },
    linkUnknowTypes(name, type) {
      return Error(
        `The message link type unknown, message name is: ${name}, type is: ${type}, when will link`,
      );
    },
    linkDuplicateType(name, type) {
      return Error(
        `The message link type duplicate, message name is: ${name}, type is: ${type}, when will link`,
      );
    },
    linkListernerMustBeFunctionType(name, type) {
      return Error(
        `The message link waiter must be a function, message name is: ${name}, type is: ${type}, when will link`,
      );
    },
    setFnNotAllowed(type) {
      return Error(`Set function but unknown type: ${type}`);
    },
  });
