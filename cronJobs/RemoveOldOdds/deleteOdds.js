const cron = require("node-cron");
const Odds = require('../../app/models/odds');
const raceOdds = require('../../app/models/raceOdds');
const { log } = require("async");
require('../../db');
const deleteClosedOddsData = async  () => {
  cron.schedule('*/2 * * * *', async () => {
    try {
      let time = Date.now() - 5 * 60 * 1000;
      let ids = await Odds.distinct('eventId');
      ids.forEach( async (id) => {
        let odd = await Odds.distinct('_id', {eventId: id , createdAt: { $lt: time }});
        console.log("  ids ===== ", odd.length);
        const counts = odd.pop();
        console.log(" ids ===== ", odd.length);
        if(odd.length){
          await Odds.deleteMany({
            '_id': {
              $in: odd
            }
          }, (err)=>{
            if(err){
              console.log(err);
            }else{
              console.log("Old odds removed successfully.");
            }
          })
        }
        
      });
    } catch (error) {
      console.error('Error :', error);
    }
  });
}
deleteClosedOddsData()
