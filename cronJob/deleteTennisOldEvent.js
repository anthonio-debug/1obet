const cron = require("node-cron");
const ListMarkets = require('../app/models/listMarkets')
const Events = require('../app/models/events');
const Odds = require('../app/models/odds');
const FancyGames = require("../app/models/fancyGames");
const moment = require('moment');
require('./db');


// There are 2 formats for  Date Month without 0 M & month with zero MM

const deleteTennisOldEventMM = () => {
  //run after 5 minutes
  cron.schedule('* * * * *', async () => {
    try {
      // Suppose 
      const eventIds  = await Events.distinct('Id',{ sportsId: '2', openDate : {$lt: moment(new Date(Date.now() - 110 * 60 * 1000)).format("M/DD/YYYY h:mm:ss +00:00") }})
      await ListMarkets.remove({ eventId: { $in: eventIds } })
      await Events.remove({ Id: { $in: eventIds } })
      await Odds.remove({eventId: { $in: eventIds } } )
      await FancyGames.remove({ eventId: { $in: eventIds }})
        
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
}
deleteTennisOldEventMM()


const deleteTennisOldEventM = () => {
  //run after 5 minutes
  cron.schedule('* * * * *', async () => {
    try {
      // Suppose 
      const eventIds  = await Events.distinct('Id',{ sportsId: '2', openDate : {$lt: moment(new Date(Date.now() - 110 * 60 * 1000)).format("M/DD/YYYY h:mm:ss +00:00") }})
      await ListMarkets.remove({ eventId: { $in: eventIds } })
      await Events.remove({ Id: { $in: eventIds } })
      await Odds.remove({eventId: { $in: eventIds } } )
      await FancyGames.remove({ eventId: { $in: eventIds }})
        
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
}
deleteTennisOldEventM()
