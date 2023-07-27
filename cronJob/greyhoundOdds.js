const cron = require("node-cron");
const Events = require('../app/models/events');
const { raceOddsJob }  = require('../app/routes/Racing');
require('../db');


const greyhoundsOddsCronJob = async () => {

  cron.schedule('*/2 * * * * *', async () => {
    try {
    
    const marketIds = await Events.distinct("marketIds", { sportsId: "4339" , islocked: false});
    //  const marketIds = await raceMarkets.distinct('eventNodes.marketNodes.marketId', { islocked: false});
     console.log('MarketID ====>', marketIds.length)


    let batchArray = []
      batchArray.push(...marketIds.slice(0, 20));
     if(marketIds.length === 0) {
      await Events.updateMany(
        {  sportsId: "4339" },
        {  islocked: false }
      );
     }
      await raceOddsJob(batchArray);
      await Events.updateMany(
        { marketIds: { $in: batchArray  }, sportsId: "4339" },
        { islocked: true }
      );

     
  
    } catch (error) {
      console.error('Error running odds cron job:', error);
    }
  });
};
greyhoundsOddsCronJob()
