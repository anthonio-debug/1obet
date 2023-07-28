const cron = require("node-cron");
const { getnewOdds } = require('./app/routes/sportsAPI')
const Events = require('./app/models/events');
require('./db');

 const cricketOddsCronJob = async () => {
    // cron.schedule('* * * * * *', async () => {
      try {
        const marketIds = await Events.distinct("marketIds", { sportsId: "2", inplay: true});
        console.log('MarketID', marketIds);
        let batchArray = [];
        for (let i = 0; i < marketIds.length; i += 20) {
          batchArray.push(marketIds.slice(i, i + 20));
        }
        for (let i = 0; i < batchArray.length; i++) {
          await getnewOdds(batchArray[i]);
        }
      
      } catch (error) {
        console.error('Error running odds cron job:', error);
      }
    // });
};

cricketOddsCronJob()











//  pm2 restart ./server.js ./socketServer.js ./testSocket.js ./cronJob/BettingCalculation.js ./cronJob/cricketOddsCronjob.js ./cronJob/deleteClosedOdds.js ./cronJob/fancyOdds.js  ./cronJob/GetEventsAndMarkets.js ./cronJob/GetRaceEventsAndMarkets.js ./cronJob/greyhoundOdds.js ./cronJob/horseRaceOdds.js ./cronJob/raceMarkets.js ./cronJob/soccerOddsCronjob.js ./cronJob/tennisOddsCronJob.js ./cronJob/themeChanging.js     
//  pm2 restart 180 181 182 183 184 185 186 187 188 189 190 191 192 193 194











