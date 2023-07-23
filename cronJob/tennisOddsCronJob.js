const cron = require("node-cron");
const ListMarkets = require('../app/models/listMarkets')
const { getnewOdds } = require('../app/routes/sportsAPI')
require('./db')

const tennisOddsCronJob = () => {
    // Cron job to run every 1 sec
    cron.schedule('* * * * * *', async () => {
      try {
        
        const marketIds = await ListMarkets.distinct("marketId", { islocked: false ,sportsId: "2" });
        console.log('MarketID', marketIds.length)
        if(marketIds.length === 0) {
          await ListMarkets.updateMany(
            {  sportsId: "2" },
            {  islocked: false }
          );
        }else {
          let batchArray = []
            batchArray.push(...marketIds.slice(0, 20));
          
  
          await getnewOdds(batchArray);
          await ListMarkets.updateMany(
            { marketId: { $in: batchArray  }, sportsId: "2" },
            { islocked: true }
          );
        }
      
      } catch (error) {
        console.error('Error running odds cron job:', error);
      }
    });
  };

tennisOddsCronJob()