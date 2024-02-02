const Session = require("../app/models/Session");

const calculateSessionNo = (type, currentOver, inning) => {
  // let divider = 5
  // let sessionNo = 0
  // if (type === 'TEST') {
  //   divider = 10
  // }
  // if (over % divider === 0) {
  //   sessionNo = over / divider;
  // } else {
  //   sessionNo = Math.floor(over / divider) + 1;
  // }
  // return sessionNo
  const sessionLength = type === "TEST" ? 10 : 5;
  let sessionAddition = 0;
  if (inning === 2) {
    if (type === "TEST") {
      sessionAddition = 9;
    } else if (type === "ODI") {
      sessionAddition = 10;
    } else if (type === "T20") {
      sessionAddition = 4;
    } else if (type === "T10") {
      sessionAddition = 2;
    }
  }
  let sessionNo = Math.floor(currentOver / sessionLength) + sessionAddition;
  return sessionNo
}
module.exports = {calculateSessionNo}