const cron = require("node-cron");
const ListMarkets = require('../app/models/listMarkets')
const { getnewOdds } = require('../app/routes/sportsAPI')
require('./db')

const cricketOddsCronJob = () => {
    // Cron job to run every 1 sec
    cron.schedule('* * * * * *', async () => {
        try {
        
        const marketIds = await ListMarkets.distinct("marketId", { islocked: false ,sportsId: "4" });
        console.log('MarketID', marketIds.length)
        if(marketIds.length == 0) {
          await ListMarkets.updateMany(
            {  sportsId: "4" },
            {  islocked: false }
          );
        }else {
          let batchArray = []
            batchArray.push(...marketIds.slice(0, 20));
          
  
          await getnewOdds(batchArray);
          await ListMarkets.updateMany(
            { marketId: { $in: batchArray  }, sportsId: "4" },
            { islocked: true }
          );
        }
      
      } catch (error) {
        console.error('Error running odds cron job:', error);
      }
    });
};

cricketOddsCronJob()