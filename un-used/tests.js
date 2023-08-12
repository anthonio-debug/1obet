const moment = require('moment');

const date = moment(new Date(Date.now() - 6*24*60*60*1000)).format("MM/D/YYYY h:mm:ss +00:00");

console.log(date);