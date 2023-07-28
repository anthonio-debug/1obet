const cron = require("node-cron");
const ListMarkets = require('../app/models/listMarkets')
const { getnewOdds } = require('../app/routes/sportsAPI')
const Events = require('../app/models/events');
require('../db');

const soccerOddsCronJob = () => {
    // Cron job to run every 1 sec
    cron.schedule('* * * * * *', async () => {
      try {
        const marketIds = await Events.distinct("marketIds", { sportsId: "1", inplay: true});
        console.log('MarketID', marketIds);
        let batchArray = [];
        for (let i = 0; i < marketIds.length; i += 20) {
          batchArray.push(marketIds.slice(i, i + 20));
        }
        for (let i = 0; i < batchArray.length; i++) {
          await getnewOdds(batchArray[i]);
        }
      
      } catch (error) {
        console.error('Error running odds cron job:', error);
      }
    });
};

soccerOddsCronJob()