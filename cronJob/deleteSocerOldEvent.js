const cron = require("node-cron");
const ListMarkets = require('../app/models/listMarkets')
const Events = require('../app/models/events');
const Odds = require('../app/models/odds');
const FancyGames = require("../app/models/fancyGames");
const moment = require('moment');
require('./db');

const deleteSoccerOldEvent = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      // Suppose 
      const soccer     = moment(new Date(Date.now() - 110 * 60 * 1000)).format("MM/DD/YYYY h:mm:ss A Z");
      const eventIds  = await Events.distinct('Id',{ sportsId: '1', openDate : {$lt: soccer}})
      await ListMarkets.remove({ eventId: { $in: eventIds } })
      await Events.remove({ Id: { $in: eventIds } })
      await Odds.remove({eventId: { $in: eventIds } } )
      await FancyGames.remove({ eventId: { $in: eventIds }})
        
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
}
deleteSoccerOldEvent()
