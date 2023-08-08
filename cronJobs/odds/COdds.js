const cron = require("node-cron");
const ListMarkets = require('../app/models/listMarkets');
const Events = require('../app/models/events');
const { getnewOdds } = require('../app/routes/sportsAPI')
require('../db');

const cricketOddsCronJob = () => {
    cron.schedule('* * * * * *', async () => {
      try {
        const marketIds = await Events.distinct("marketIds", { sportsId: "4", inplay: true, iconStatus:true });
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

cricketOddsCronJob()