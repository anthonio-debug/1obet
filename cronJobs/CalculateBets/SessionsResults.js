
// const cron    = require("node-cron");
const {sessionCalc} = require("../../app/routes/bets");
const { log } = require("async");
const SessionsResults = async  () => {
  try {
    console.log(" Calculation Is Calling ");
    await sessionCalc()
  } catch (error) {
    console.error('Error running odds cron job:', error);
  }
};
SessionsResults()
