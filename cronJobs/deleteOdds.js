const cron = require('node-cron');
const Odds = require('../app/models/odds');
const RaceOdds = require('../app/models/raceOdds');
const fancyOdds = require('../app/models/fancyOdds');

const deleteOdds = () => {
  console.log('running delete odds cron job');
  cron.schedule('*/60 * * * *', async () => {
    try {
      const date = new Date().getTime() - 60 * 60 * 1000;
      await Odds.deleteMany({ createdAt: { $lt: date } });
      await RaceOdds.deleteMany({ createdAt: { $lt: date } });
      await fancyOdds.deleteMany({ created: { $lt: date } });
    } catch (error) {
      console.error('Error running delete odds cron job:', error);
    }
  });
};

deleteOdds();
