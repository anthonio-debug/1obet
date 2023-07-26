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

// pm2 start ./server.js ./socketServer.js ./cronJob/raceMarkets.js  ./cronJob/fancyOdds.js ./testSocket.js ./cronJob/cricketOddsCronjob.js ./cronJob/soccerOddsCronjob.js  ./cronJob/tennisOddsCronJob.js ./cronJob/todayRace.js ./cronJob/deleteClosedOdds.js ./cronJob/deleteCricketOldEvent.js ./cronJob/deleteGHR.js ./cronJob/deleteOdds.js ./cronJob/deleteSoccerOldEvent.js ./cronJob/deleteTennisOldEvent.js ./cronJob/greyhoundOdds.js ./cronJob/horseRaceOdds.js ./cronJob/listSupportsAndMarkets.js   ./cronJob/themeChanging.js   ./cronJob/BettingCalculation.js --watch 

// pm2 stop  160 161 162 163 164 165 166 167 168 169 170 171 172 173 174 175 176 177 178 179