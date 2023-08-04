const cron = require("node-cron");const Events = require('../app/models/events');
const { todayRaceJob, raceOddsJob }  = require('../app/routes/Racing');
require('../db');


const findOddsForOneTime = async (ids) => {
  try{   
      console.log("=============== ids ", ids);
      const marketId = await Events.distinct("marketIds", { '_id': { $in: ids}});
      console.log('========= Market ID ', marketId);
      let batchArray = [];
      for (let i = 0; i < marketId.length; i += 20) {
      batchArray.push(marketId.slice(i, i + 20));
      }
      for (let i = 0; i < batchArray.length; i++) {
          await raceOddsJob(batchArray[i]);
      }
  } catch (error) {
      console.error('Error running odds cron job:', error);
  }
}

const GetRaceEventsAndMarkets = async () => {

  cron.schedule('*/2 * * * *', async () => {
    try {
      const {eventIds} =  await todayRaceJob("4339"); 
      await findOddsForOneTime(eventIds)
    } catch (error) {
      console.error('Error running Race list Market cron job:', error);
    }
  });

};
GetRaceEventsAndMarkets();
