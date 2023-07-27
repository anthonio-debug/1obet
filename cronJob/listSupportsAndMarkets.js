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

const listMarketCronJob = () => {
   // Cron job to run every 1 minute
   cron.schedule('*/1 * * * *', async () => {
        try {
        // Retrieve the IDs from the inplayEvents api
        const sportsIds = [4,2,1]; // Set the desired sports IDs here

        // Iterate over sportsIds
        for (const sportsId of sportsIds) {

            const listInplayEventsResponse = await listInplayEventsJob(sportsId);
            const listInplayEventsData = listInplayEventsResponse.inplayEvents
            console.log('Data of InPlay Event', listInplayEventsData)

            const dummydata = listInplayEventsData.map(async(item)=>{
                let eventId = item.Id
                let sportsId = item.sport
                const event = Event.findOne({
                    eventId: eventId,
                    sportsId: 4
                })
                if(event.sportsId == 4 && event.iconStatus == true && event.marketIds.length == 0 ){
                    listMarketsResponse = await listMarketsByCronJob(eventId,sportsId);
                }
                else if(event.sportsId != 4 && event.marketIds.length == 0){
                    listMarketsResponse = await listMarketsByCronJob(eventId,sportsId);
                }
            })
        }
        } catch (error) {
        console.error('Error running listMarket cron job:', error);
        }
    });
}
listMarketCronJob()
