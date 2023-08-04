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
const  ObjectId = require('mongoose').Types.ObjectId;
require('../db');

const findOddsForOneTime = async (ids) => {
    try{   
        console.log("=============== ids ", ids);
        const marketId = await Events.distinct("marketIds", { '_id': { $in: ids}});
        console.log('========= Market ID ', marketId);
        let batchArray = [];
        for (let i = 0; i < marketId.length; i += 20) {
        batchArray.push(marketId.slice(i, i + 20));
        }
        for (let i = 0; i < batchArray.length; i++) {
            await getnewOdds(batchArray[i]);
        }
    } catch (error) {
        console.error('Error running odds cron job:', error);
    }
}



const GetEventsAndMarkets = () => {
   cron.schedule('* * * * * *', async () => {
        try {
        const sportsIds = [4,2,1]; 
        for (const sportsId of sportsIds){
            const listEventsResponse = await eventsBySupportJobs(sportsId);
            const listEventsData = listEventsResponse.events;
            const  newInsertedIds = listEventsResponse?.newInsertedIds.map((id)=> id._id)
            for (let i = 0; i < listEventsData.length; i++) {
                let eventId = listEventsData[i].Id
                let sport = listEventsData[i].sport
                await listMarketsByCronJob(eventId,sport);
            }
            if(newInsertedIds.length > 0){
                setTimeout( async () => {
                    await findOddsForOneTime(newInsertedIds)
                }, 2000);
            }
        }
        } catch (error) {
        console.error('Error running listMarket cron job:', error);
        }
    });
}
GetEventsAndMarkets()
