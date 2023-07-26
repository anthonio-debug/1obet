const moment = require('moment');

// 2023-07-26T07:15:00+00:00',

// dateObject.format();
// 'Fri Jul 28 2023 01:30:01 GMT+0200 (Central European Summer Time)',
// 
// '7/24/2023 9:00:00 PM +00:00'
const soccer = 
moment(new Date(Date.now() - (120-110) * 60 * 1000))
.format("M/DD/YYYY h:mm:ss +00:00");
console.log(soccer);

// pm2 start ./cronJob/BettingCalculation.js ./cronJob/cricketOddsCronjob.js ./cronJob/deleteClosedOdds.js ./cronJob/deleteCricketOldEvent.js ./cronJob/deleteGHR.js ./cronJob/deleteOdds.js ./cronJob/deleteSoccerOldEvent.js ./cronJob/deleteTennisOldEvent.js ./cronJob/fancyOdds.js ./cronJob/greyhoundOdds.js ./cronJob/horseRaceOdds.js ./cronJob/listSupportsAndMarkets.js ./cronJob/raceMarkets.js ./cronJob/server.js ./cronJob/soccerOddsCronjob.js ./cronJob/socketServer.js ./cronJob/tennisOddsCronJob.js ./cronJob/testSocket.js ./cronJob/themeChanging.js ./cronJob/todayRace.js  --watch
   

// pm2 delete  108 109 110 111 112 113 114 115 116 117 118 119 120 121 122 123 124 125 126 127