function isIterable(obj) {
  // Checks if obj is not null and its Symbol.iterator property is a function
  return obj != null && typeof obj[Symbol.iterator] === 'function';
}

module.exports = {isIterable}
