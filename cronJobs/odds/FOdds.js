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
