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
 runningJob = cron.schedule("*/1 * * * *", async () => {
   try {
     const endedMatches = await getEndedMatches('2');
     console.log("endedMatches", endedMatches);
     for (const match of endedMatches){
       const bets = await getAllBets(match._id); 
       console.log(" ========", bets);
       for (const bet of bets) {
         if (bet.type == 0 && bet.runner == match.winner) {
          console.log("0 ----- winner ");
          await handleWinningBet(bet);

         } else if (bet.type == 0 && bet.runner != match.winner) {
          console.log("0 ----- looser ");
          await handleLosingBet(bet);

         } else if (bet.type == 1 && bet.runner != match.winner) {
          console.log("1 ----- winner ");
          await handleWinningBet(bet);

         } else if (bet.type == 1 && bet.runner == match.winner) {
          console.log("1 ----- looser ");
          await handleLosingBet(bet);

         } else {
          console.log("-----  Draw ");
          await handleDrawBet(bet);
         }
       }
       await Events.updateOne({ _id: match._id }, { betSettled: true });
     }
   } catch (err) {
     console.error(err);
   }
 });
};

checkBetStatus();