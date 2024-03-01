function isIterable(obj) {
  // Checks if obj is not null and its Symbol.iterator property is a function
  return obj != null && typeof obj[Symbol.iterator] === 'function';
}
function isObjectEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}
module.exports = {isIterable, isObjectEqual}
