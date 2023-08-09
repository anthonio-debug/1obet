const cron = require("node-cron");
const Events = require('../../app/models/events');
const {
  getAllBets,
  getEndedMatches,
  handleLosingBet,
  handleWinningBet, 
  handleDrawBet
} = require('./calculations')

require('../../db');


// betSettled  winner


const checkBetStatus = (req) => {
 runningJob = cron.schedule("*/3 * * * *", async () => {
   try {
     const endedMatches = await getEndedMatches('4');
     console.log("endedMatches", endedMatches);
     for (const match of endedMatches){
       const bets = await getAllBets(match.Id); 
       for (const bet of bets) {
         if (bet.type == 0 && bet.runner == match.winner) {
           handleWinningBet(req, bet);

         } else if (bet.type == 0 && bet.runner != match.winner) {
           handleLosingBet(req, bet);

         } else if (bet.type == 1 && bet.runner != match.winner) {
           handleWinningBet(req, bet);

         } else if (bet.type == 1 && bet.runner == match.winner) {
           handleLosingBet(req, bet);

         } else {
           handleDrawBet(req, bet);
         }
       }
       Event.updateOne({ _id: match._id }, { betSettled: true });
     }
   } catch (err) {
     console.error(err);
   }
 });
};

checkBetStatus();