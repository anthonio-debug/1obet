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
require('./db');


const raceOddsCronJob = async () => {

  cron.schedule('*/2 * * * * *', async () => {
    try {
      const racesportsIds = ["7", "4339"];
    const marketIds = await Events.distinct("marketIds", { sportsId: { $in: racesportsIds } , islocked: false});
    //  const marketIds = await raceMarkets.distinct('eventNodes.marketNodes.marketId', { islocked: false});
     console.log('MarketID ====>', marketIds)


    let batchArray = []
      batchArray.push(...marketIds.slice(0, 20));
     if(marketIds.length === 0) {
      await Events.updateMany(
        { },
        {  islocked: false }
      );
     }
      await raceOddsJob(batchArray);
      await Events.updateMany(
        { marketIds: { $in: batchArray  } },
        { islocked: true }
      );

     
  
    } catch (error) {
      console.error('Error running odds cron job:', error);
    }
  });
};
raceOddsCronJob()
