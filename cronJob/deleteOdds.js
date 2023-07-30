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
cron.schedule('*/3 * * * *', async () => {
    try {
      let time = Date.now() - 5 * 60 * 1000;
      await Odds.remove({
        createdAt: {
          $lt: time
        }
      }, (err, data)=>{
        if(err){
          console.log(err);
        }else{
          console.log("Old odds removed successfully.");
          console.log(data);
        }
      })

      await raceOdds.remove({
        createdAt: {
          $lt: time
        }
      }, (err, data)=>{
        if(err){
          console.log(err);
        }else{
          console.log("Old odds removed successfully.");
          console.log(data);
        }
      })
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
}
deleteClosedOddsData()
