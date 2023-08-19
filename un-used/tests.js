// const moment = require('moment');

// const date = moment(new Date(Date.now() - 6*24*60*60*1000)).format("MM/D/YYYY h:mm:ss +00:00");


// let dtStr = "12/03/2010 09:55:35"

// console.log(strToDate(dtStr));

const originalArray = [5, 5, 6, 6, 2, 1, 1, 2, 2, 3, 4, 4, 5];
const uniqueArray = [...new Set(originalArray)];

console.log("uniqueArray ========= ", uniqueArray);



// console.log(date);