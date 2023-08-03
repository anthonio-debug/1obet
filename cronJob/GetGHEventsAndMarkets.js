const cron = require("node-cron");const Events = require('../app/models/events');
const { todayRaceJob }  = require('../app/routes/Racing');
require('../db');
const GetRaceEventsAndMarkets = async () => {
  cron.schedule('*/1 * * * *', async () => {
    try {
      await todayRaceJob("4339");
    } catch (error) {
      console.error('Error running Race list Market cron job:', error);
    }
  });
};
GetRaceEventsAndMarkets();
