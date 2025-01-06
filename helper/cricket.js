const calculateSessionNo = (scores) => {
  /*from bets.js*/
  let currentSession
  let type = scores.type;
  let inning = scores.inning;
  let currentOver = (scores.activeTeam === scores.team1ShortName) ? scores.over1 : scores.over2
  let sessionAddition = 0;
  const sessionAdditionTimes = inning - 1
  if (inning !== 1) {
    if (type === "TEST") {
      sessionAddition = 9 * sessionAdditionTimes;
    } else if (type === "ODI") {
      sessionAddition = 10 * sessionAdditionTimes;
    } else if (type === "T20") {
      sessionAddition = 4 * sessionAdditionTimes;
    } else if (type === "T10") {
      sessionAddition = 2 * sessionAdditionTimes;
    }
  }

  currentSession = Math.ceil(currentOver / 5) + sessionAddition;

  switch (type) {
    case "T10":
      break;
    case "T20":
      break;
    case "ODI":
      break;
    case "TEST":
      currentSession = Math.ceil(currentOver / 10) + sessionAddition;
      break;
  }

  // if (type === "TEST" && scores?.day > 1) {
  //   currentSession = currentSession + 18
  // }
  return currentSession
}

const calculateBetSession = (scores) => {
  let currentSession
  let type = scores.type;
  let inning = parseInt(scores.inning);
  let currentOver = scores.activeTeam === scores.team1ShortName ? scores.over1 : scores.over2;
  // console.log("1-currentOver----------------",currentOver);
  let sessionAddition = 0;
  const sessionAdditionTimes = inning - 1;
  if (inning !== 1) {
    if (type === 'TEST') {
      sessionAddition = 9 * sessionAdditionTimes;
    } else if (type === 'Test') {
      sessionAddition = 9 * sessionAdditionTimes;
    } else if (type === 'ODI') {
      sessionAddition = 10 * sessionAdditionTimes;
    } else if (type === 'T20') {
      sessionAddition = 4 * sessionAdditionTimes;
    } else if (type === 'T10') {
      sessionAddition = 2 * sessionAdditionTimes;
    }
  }
  let totalSessions = 0;
  let currentSessionOver = Math.ceil(currentOver % 5);
  // console.log("1-currentSessionOver----------------",currentSessionOver);

  currentSession = Math.ceil(currentOver / 5) + sessionAddition;
  // console.log("1-currentSession----------------",currentSession);
  switch (type) {
    case 'T10':
      totalSessions = 2;
      break;
    case 'T20':
      totalSessions = 4;
      break;
    case 'ODI':
      totalSessions = 10;
      break;
    case 'TEST':
      totalSessions = 9;

      // console.log("1-totalSessions----------------",totalSessions);
      currentSessionOver = Math.ceil(currentOver % 10);
      // console.log("2-currentSessionOver----------------",currentSessionOver);

      currentSession = Math.ceil(currentOver / 10) + sessionAddition;
      // console.log("2-currentSession----------------",currentSession);

      break;
    case 'Test':
      totalSessions = 9;

      // console.log("1-totalSessions----------------",totalSessions);
      currentSessionOver = Math.ceil(currentOver % 10);
      // console.log("2-currentSessionOver----------------",currentSessionOver);

      currentSession = Math.ceil(currentOver / 10) + sessionAddition;
      // console.log("2-currentSession----------------",currentSession);

      break;
    default:
      break;
  }
  return currentSession
}

module.exports = {calculateSessionNo, calculateBetSession}
