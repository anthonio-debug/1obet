const cron = require("node-cron");const Events = require('../app/models/events');
const { todayRaceJob }  = require('../app/routes/Racing');
require('../db');
const GetRaceEventsAndMarkets = async () => {
  cron.schedule('*/1 * * * *', async () => {
    try {
      const raceSportsIds = ["7","4339"]; 
      for (const SportId of raceSportsIds) {
        await todayRaceJob(SportId);
      }
   }
    catch (error) {
      console.error('Error running Race list Market cron job:', error);
    }
  });
};
GetRaceEventsAndMarkets()
