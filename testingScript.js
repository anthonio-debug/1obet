const moment = require('moment');

// 2023-07-26T07:15:00+00:00',

// dateObject.format();
// 'Fri Jul 28 2023 01:30:01 GMT+0200 (Central European Summer Time)',
// 
// '7/24/2023 9:00:00 PM +00:00'
const soccer = 
moment(new Date(Date.now() - (120-110) * 60 * 1000))
.format("M/DD/YYYY h:mm:ss A Z");
console.log(soccer);
// const x =10;
// setInterval(() => {
//     if(true == true){
//         x =5;
//         console.log(x + 1)
//     }
// }, 500);
    
