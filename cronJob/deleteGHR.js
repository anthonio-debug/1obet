const cron = require("node-cron");
const Events = require('../app/models/events');
const raceOdds = require('../app/models/raceOdds'); 
const raceMarkets = require("../app/models/raceMarkets");
const moment = require('moment');
require('./db');

const deleteGHR = () => {
  //run after 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const GHR           = moment(new Date(Date.now() - 10 * 60 * 1000)).format("YYYY-MM-DDTH:mm:ss+00:00");
      const eventIds      = await Events.distinct('meetingId',{ sportsId: { $in: ['7', '4339'] }, openDate : {$lt: GHR}})
      let marketIds       = await raceMarkets.distinct('marketId',{ eventIds : { $in: eventIds } })
      await Events.remove({ meetingId: {  $in: eventIds  } })
      await raceOdds.remove({ marketId: {  $in: marketIds  } })
      await raceMarkets.remove({ marketId: {  $in: marketIds  } })
    } 
    catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
}
deleteGHR()
