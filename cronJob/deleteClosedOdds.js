const cron = require("node-cron");
const axios = require("axios");
const Bets = require("../app/models/bets");
const CricketMatch = require("../app/models/cricketMatches");
const User = require("../app/models/user");
const Settings = require("../app/models/settings");
const Cash = require("../app/models/deposits");
const { getParents } = require("../app/routes/bets");
const { listMarketsByCronJob ,getnewOdds,fancyDataByCronjob,listInplayEventsJob} = require('../app/routes/sportsAPI')
const ListMarkets = require('../app/models/listMarkets')
const Events = require('../app/models/events');
const { todayRaceJob, marketDescriptionCronjob,raceOddsJob }  = require('../app/routes/Racing');
const Odds = require('../app/models/odds');
const raceOdds = require('../app/models/raceOdds');
const FancyGames = require("../app/models/fancyGames");
const raceMarkets = require("../app/models/raceMarkets");
require('../db');


const deleteClosedOddsData = () => {
  //run after 5 minutes
cron.schedule('*/5 * * * *', async () => {
    try {
        //FOR CRICKET , TENNNIS , SOCCER
        let sportsData = ["1","2","4"];
        let events = await Events.distinct('Id',{ status: "CLOSED", sportsId: { $in: sportsData }})
        await ListMarkets.remove({ eventId: { $in: events } })
        await Events.remove({ Id: { $in: events } })
        await Odds.remove({ $or: [ {eventId: { $in: events } }, {  status: { $in: ["closed", "Closed", "CLOSED"] } } ] })
        await FancyGames.remove({ eventId: { $in: events }})

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
deleteClosedOddsData()
