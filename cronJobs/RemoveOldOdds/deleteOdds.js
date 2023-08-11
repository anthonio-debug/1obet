const cron = require("node-cron");
const Odds = require('../../app/models/odds');
const raceOdds = require('../../app/models/raceOdds');
const { log } = require("async");
require('../../db');
const deleteClosedOddsData = async  () => {
  cron.schedule('*/2 * * * *', async () => {
    try {
      let time = Date.now() - 5 * 60 * 1000;
      let ids = await Odds.distinct('eventId', {createdAt: { $lt: time }});
      ids.forEach( async (id) => {
        let odd = await Odds.distinct('_id', {eventId: id , createdAt: { $lt: time }});
        console.log("  ids ===== ", odd.length);
        if(odd.length > 0){
          odd.pop();
          console.log(" ids ===== ", odd.length);
          if(odd.length > 0){

            const deleteQuery = Odds.deleteMany({
              _id: { '$in': odd }
            });

            deleteQuery.exec((err, success)=>{
              if(err){
                console.log(err);
              }else{
                console.log("Old odds removed successfully.");
              }
            })
          }
        }
      });
    } catch (error) {
      console.error('Error :', error);
    }
  });
}
deleteClosedOddsData()
