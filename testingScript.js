const moment = require('moment');

// 2023-07-26T07:15:00+00:00',

// dateObject.format();
// 'Fri Jul 28 2023 01:30:01 GMT+0200 (Central European Summer Time)',
// 
const soccer = 
moment(new Date(Date.now() - (120-110) * 60 * 1000))
.format("ddd MMM DD YYYY HH:mm:ss ") + "GMT+0200 (Central European Summer Time)";
console.log(soccer);
