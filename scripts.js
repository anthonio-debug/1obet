const moment = require('moment');
const soccer = 
moment(new Date(Date.now()))
.format("M/DD/YYYY h:mm:ss +00:00");
const soccer2 =  
moment(new Date(Date.now()))
.format("M/DD/YYYY h:mm:ss +00:00");

const soccer3 =  
moment(new Date(Date.now()))
.format("M/DD/YYYY h:mm:ss +00:00").toString();

console.log(soccer);
console.log(soccer2);
console.log(soccer3);