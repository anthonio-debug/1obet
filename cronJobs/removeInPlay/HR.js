const cron    = require("node-cron");
const axios   = require('axios');
const config  = require('config');
const Events  = require('../../app/models/events');
const moment  = require('moment');
require('../../db');

const addInPlayFalse = async (eventIds) => {
  eventIds.forEach(async (eventId) => {
    const event = await Events.findOne({ Id: eventId });
    const url = `${config.horseRaceUrl}/results/?ids=${event.marketIds[0]}`;
    const response = await axios.get(url);
    console.log("Results =", response?.data.length);
    if (response?.data.length > 0){
      await Events.findOneAndUpdate(
        { Id: eventId },
        {
          $set: {
            inplay: false,
            winner: response?.data[0]?.winnerSelectionId
          },
        }
      );
    }
    console.log("response>>>>>>>>>>>>>", response.data);
  })
};


const HR = () => {
  cron.schedule('*/1 * * * *', async () => {

    try {
      const date  = new Date().getTime();
      // moment(new Date(Date.now())).format("YYYY-MM-DDTHH:mm:ss+00:00");
      const eventIds     = await Events.distinct('Id',{ 
        sportsId: '7',
        winner: '0',
        openDate : {$lt: date}
        // inplay: true
      });
      console.log("Total event Ids = ", eventIds.length);
      if(eventIds.length > 0){
        await addInPlayFalse(eventIds)
      }
    } catch(error){
      console.error('Error running listMarket cron job:', error);
    }
  });
}

HR()

