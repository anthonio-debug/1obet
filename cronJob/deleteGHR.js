const cron = require("node-cron");
const axios = require("axios");
const Bets = require("../app/models/bets");
const CricketMatch = require("../app/models/cricketMatches");
const User = require("../app/models/user");
const Settings = require("../app/models/settings");
const Cash = require("../app/models/deposits");
const { getParents } = require("../app/routes/bets");
const ListMarkets = require('../app/models/listMarkets')
const Events = require('../app/models/events');
const Odds = require('../app/models/odds');
const raceOdds = require('../app/models/raceOdds');
const FancyGames = require("../app/models/fancyGames");
const raceMarkets = require("../app/models/raceMarkets");
const moment = require('moment');
require('./db');


const deleteGHR = () => {
  //run after 5 minutes
cron.schedule('*/5 * * * *', async () => {
    try {

      const GHR           = moment(new Date(Date.now() - 10 * 60 * 1000)).format("YYYY-MM-DDTH:mm:ss+00:00");
      const eventIds      = await Events.distinct('eventId',{ sportsId: { $in: ['7', '4339'] }, openDate : {$lt: GHR}})
      let marketIds       = await raceMarkets.distinct('marketId',{ eventIds : { $in: eventIds } })
      await Events.remove({ Id: {  $in: eventIds  } })
      await raceOdds.remove({ marketId: {  $in: marketIds  } })
      await raceMarkets.remove({ marketId: {  $in: marketIds  } })
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
}
deleteGHR()


const deleteClosedOddsData = () => {
cron.schedule('*/5 * * * *', async () => {
    try {
        let raceMarketIds = await raceMarkets.distinct('marketId',{ status : 'CLOSED' })

        await Events.remove({ marketIds: {  $in: raceMarketIds  } })
        await raceOdds.remove({ marketId: {  $in: raceMarketIds  } })
        await raceMarkets.remove({ marketId: {  $in: raceMarketIds  } })
        
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
}
deleteClosedOddsData()
