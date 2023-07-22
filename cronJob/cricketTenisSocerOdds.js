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

const cricketTenisSocerOddsCronJob = () => {
  // Cron job to run every 1 sec
  cron.schedule('* * * * * *', async () => {
    try {
      
      const marketIds = await ListMarkets.distinct("marketId", { islocked: false });
      console.log('MarketID', marketIds)
      if(marketIds.length === 0) {
        await ListMarkets.updateMany(
          { },
          {  islocked: false }
        );
      }else {
        let batchArray = []
          batchArray.push(...marketIds.slice(0, 20));
        

        await getnewOdds(batchArray);
        await ListMarkets.updateMany(
          { marketId: { $in: batchArray  } },
          { islocked: true }
        );
      }
    
    } catch (error) {
      console.error('Error running odds cron job:', error);
    }
  });
};
cricketTenisSocerOddsCronJob()
