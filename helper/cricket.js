const Session = require("../app/models/Session");

const calculateSessionNo = (scores) => {
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
  // old
  // const sessionLength = type === "TEST" ? 10 : 5;
  // let sessionAddition = 0;
  // if (inning === 2) {
  //   if (type === "TEST") {
  //     sessionAddition = 9;
  //   } else if (type === "ODI") {
  //     sessionAddition = 10;
  //   } else if (type === "T20") {
  //     sessionAddition = 4;
  //   } else if (type === "T10") {
  //     sessionAddition = 2;
  //   }
  // }
  // let sessionNo = Math.floor(currentOver / sessionLength) + sessionAddition;
  // return sessionNo
  /*from bets.js*/
  let currentSession
  let type = scores.type;
  let inning = scores.inning;
  let currentOver = scores.over1
  let score = scores.score1
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
  let totalSessions = 0;

  let currentSessionOver = Math.ceil(currentOver % 5);

  currentSession = Math.ceil(currentOver / 5) + sessionAddition;

  switch (type) {
    case "T10":
      totalSessions = 2;
      break;
    case "T20":
      totalSessions = 4;
      break;
    case "ODI":
      totalSessions = 10;
      break;
    case "TEST":
      totalSessions = 9;
      currentSessionOver = Math.ceil(currentOver % 10);
      currentSession = Math.ceil(currentOver / 10) + sessionAddition;
      break;
  }

  if (type === "TEST" && score?.day > 1) {
    currentSession = currentSession + 18
  }
  return currentSession
}
module.exports = {calculateSessionNo}