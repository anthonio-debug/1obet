// cron.js

const {themeCronJob,checkBetStatus,oddsCronJob,listMarketCronJob,fancyDataCronJob} = require('./cronJob/cronJob');
  
  // Run the cron jobs
  themeCronJob();
  checkBetStatus();
  listMarketCronJob();
  oddsCronJob();
  fancyDataCronJob();
  