const cron = require("node-cron");
const ListMarkets = require('../app/models/listMarkets')
const Events = require('../app/models/events');
const { marketDescriptionCronjob}  = require('../app/routes/Racing');
require('../db');

const raceMarketsCronJob = async () => {
  // Cron job to run every 1 minute
  cron.schedule('*/1 * * * *', async () => {
    try {
      const marketIds = await Events.distinct("marketIds", { sportsId: { $in: ["7", "4339"] } });
      for (const marketId of marketIds) {
        await marketDescriptionCronjob(marketId);
      }
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
};
raceMarketsCronJob()
