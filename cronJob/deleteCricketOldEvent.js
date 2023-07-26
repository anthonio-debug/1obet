const cron = require("node-cron");
const ListMarkets = require('../app/models/listMarkets')
const Events = require('../app/models/events');
const Odds = require('../app/models/odds');
const raceOdds = require('../app/models/raceOdds');
const FancyGames = require("../app/models/fancyGames");
const raceMarkets = require("../app/models/raceMarkets");
const moment = require('moment');
require('./db');

const deleteCricketOldEvent = () => {

  cron.schedule('*/5 * * * *', async () => {
    try {

      // Suppose if its cricket match and its type is T10, we can remove it after 3 hours. 
      // Similarly if its T20, we can remove after 5 hours, 
      // Oneday after 9 hours. 
      // Test Match after 107 hours.

      const TEN     = moment(new Date(Date.now() - 3 *    60 * 60 * 1000)).format("MM/DD/YYYY h:mm:ss A Z");
      const TWENTY  = moment(new Date(Date.now() - 5 *    60 * 60 * 1000)).format("MM/DD/YYYY h:mm:ss A Z");
      const ODI     = moment(new Date(Date.now() - 9 *    60 * 60 * 1000)).format("MM/DD/YYYY h:mm:ss A Z");
      const TEST    = moment(new Date(Date.now() - 107 *  60 * 60 * 1000)).format("MM/DD/YYYY h:mm:ss A Z");

      const T_TEN     = await Events.distinct('Id',{ sportsId: '4', matchType: 'T10',  openDate : {$lt: TEN}})
      const T_TWENTY  = await Events.distinct('Id',{ sportsId: '4', matchType: 'T20',  openDate : {$lt: TWENTY}})
      const T_ODI     = await Events.distinct('Id',{ sportsId: '4', matchType: 'ODI',  openDate : {$lt: ODI}})
      const T_TEST    = await Events.distinct('Id',{ sportsId: '4', matchType: 'TEST', openDate : {$lt: TEST}})
      const eventIds  = T_TEN.concat(T_TWENTY).concat(T_ODI).concat(T_TEST);


      await ListMarkets.remove({ eventId: { $in: eventIds } })
      await Events.remove({ Id: { $in: eventIds } })
      await Odds.remove({eventId: { $in: eventIds } } )
      await FancyGames.remove({ eventId: { $in: eventIds }})

      // let raceEvents = await Events.distinct('Id',{ status: "CLOSED", sportsId: { $in: sportsEvent }})

      // FOR HORSE RACE AND GRAYHOUND
      let raceMarketIds = await raceMarkets.distinct('marketId',{ status : 'CLOSED' })
      await Events.remove({ marketIds: {  $in: raceMarketIds  } })
      await raceOdds.remove({ marketId: {  $in: raceMarketIds  } })
      await raceMarkets.remove({ marketId: {  $in: raceMarketIds  } })
        
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });

}
deleteCricketOldEvent()
