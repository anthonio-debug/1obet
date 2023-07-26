const moment = require('moment');

// 2023-07-26T07:15:00+00:00',

const soccer = 
moment(new Date(Date.now() - 10 * 60 * 1000))
.format("YYYY-MM-DDTH:mm:ss+00:00");
console.log(soccer);