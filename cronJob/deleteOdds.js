const cron = require("node-cron");
const Odds = require('../app/models/odds');
const raceOdds = require('../app/models/raceOdds');
require('../db');
const deleteClosedOddsData = () => {
  cron.schedule('* * * * *', async () => {
    try {
      let time = Date.now() - 5 * 60 * 1000;
      // const ids = Odds.distinct('eventId', {createdAt: {
      //     $lt: time
      //   }}
      // )
      // ids.pop()
      const ids = Odds.distinct('eventId', {createdAt: { $lt: time }});
      const newIds = ids.slice(0, -1);
      await Odds.remove({
        eventId: {
          $in: newIds
        }
      }, (err, data)=>{
        if(err){
          console.log(err);
        }else{
          console.log("Old odds removed successfully.");
          console.log(data);
        }
      })
      const count = await raceOdds.remove({
        createdAt: {
          $lt: time
        }
      }, (err, data)=>{
        if(err){
          console.log(err);
        }else{
          console.log(`Old odds removed successfully. ${count}`);
          console.log(data);
        }
      })
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
}
deleteClosedOddsData()
