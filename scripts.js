// const moment = require('moment');
// const soccer = 
// moment(new Date(Date.now()))
// .format("M/DD/YYYY h:mm:ss +00:00");
// const soccer2 =  
// moment(new Date(Date.now()))
// .format("MM/DD/YYYY h:mm:ss +00:00");

// const soccer3 =  
// moment(new Date(Date.now()))
// .format("M/DD/YYYY h:mm:ss +00:00").toString();

// console.log(soccer);
// console.log("soccer MM ", soccer2);
// console.log(soccer3);



const cron = require("node-cron");
const Events = require('../app/models/events');
const { raceOddsJob }  = require('../app/routes/Racing');
require('../db');


const greyhoundsOddsCronJob = async () => {
    try {
        const marketIds = await Events.distinct("marketIds", { sportsId: "4339" , islocked: false});
        console.log("marketIds", marketIds);
        console.log('MarketID ====>', marketIds.length)

        let batchArray = []
        batchArray.push(...marketIds.slice(0, 20));
        if(marketIds.length === 0) {
        await Events.updateMany(
        {  sportsId: "4339" },
        {  islocked: false }
        );
        }
        await raceOddsJob(batchArray);
        await Events.updateMany(
        { marketIds: { $in: batchArray  }, sportsId: "4339" },
        { islocked: true }
        );
    } catch (error) {
      console.error('Error running odds cron job:', error);
    }
};
greyhoundsOddsCronJob()