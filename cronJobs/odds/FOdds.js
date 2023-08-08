const cron = require("node-cron");
const { listMarketsByCronJob ,getnewOdds,fancyDataByCronjob,listInplayEventsJob} = require('../../app/routes/sportsAPI')
const Events = require('../../app/models/events');

require('../db');

const fancyDataCronJob = async () => {
  // Cron job to run every 1 minute
  cron.schedule('*/2 * * * * *', async () => {
    try {
      // Retrieve the inPlayEvents data dynamically from the database

      const inPlayEventsData = await Events.find({ sportsId: '4', inplay: true, iconStatus:true }).exec();

      for (const event of inPlayEventsData) {
        const eventId = event.Id;
        await fancyDataByCronjob(eventId);
      }
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
};
fancyDataCronJob()
