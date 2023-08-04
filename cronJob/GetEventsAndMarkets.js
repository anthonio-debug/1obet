const cron = require("node-cron");
const axios = require("axios");
const Bets = require("../app/models/bets");
const CricketMatch = require("../app/models/cricketMatches");
const User = require("../app/models/user");
const Settings = require("../app/models/settings");
const Cash = require("../app/models/deposits");
const { getParents } = require("../app/routes/bets");
const { listMarketsByCronJob ,getnewOdds,fancyDataByCronjob,eventsBySupportJobs} = require('../app/routes/sportsAPI')
const ListMarkets = require('../app/models/listMarkets')
const Events = require('../app/models/events');
const { todayRaceJob, marketDescriptionCronjob,raceOddsJob }  = require('../app/routes/Racing');
const Odds = require('../app/models/odds');
const raceOdds = require('../app/models/raceOdds');
const FancyGames = require("../app/models/fancyGames");
const raceMarkets = require("../app/models/raceMarkets");
require('../db');

const GetEventsAndMarkets = () => {
   cron.schedule('*/1 * * * *', async () => {
        try {
        const sportsIds = [4,2,1]; 
        for (const sportsId of sportsIds){
            const listEventsResponse = await eventsBySupportJobs(sportsId);
            const listEventsData = listEventsResponse.events;
            // console.log('Data of Events', listEventsData)
            const dummydata = listEventsData.map(async(item)=>{
                let eventId = item.Id
                let sport = item.sport
                console.log("Sports Name", sport)
                let listMarketsResponse = await listMarketsByCronJob(eventId,sport);
            })
        }
        } catch (error) {
        console.error('Error running listMarket cron job:', error);
        }
    });
}
GetEventsAndMarkets()
