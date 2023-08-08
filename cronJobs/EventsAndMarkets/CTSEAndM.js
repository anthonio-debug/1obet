const cron = require("node-cron");
const { listMarketsByCronJob ,getnewOdds,fancyDataByCronjob,eventsBySupportJobs} = require('../../app/routes/sportsAPI')
const Events = require('../../app/models/events');
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
   cron.schedule('*/2 * * * * *', async () => {
        try {
        console.log("Cron Job started ==== ", new Date());
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
