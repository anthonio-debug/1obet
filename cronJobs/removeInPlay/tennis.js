const cron = require("node-cron");
const axios = require('axios');
const config = require('config');
const Events = require('../../app/models/events');
const moment = require('moment');
require('../../db');

const addInPlayFalse = async (eventIds)=>{
  eventIds.map(async (eventId)=>{
    const event     = await Events.findOne({
      Id:eventId
    });
    const url = `${config.sportsAPIUrl}/results/?ids=${event.marketIds[0]}`;
    const response = await axios.get(url);
    if(response?.data.length > 0 ){
      await Events.findOneAndUpdate(
        {Id:eventId},
        {$set : {
          inplay: false,
          winner: response?.data?.winnerSelectionId
        }}
        );
    }
    console.log("response>>>>>>>>>>>>>", response.data);
  });
}

const tennis = () => {
  cron.schedule('*/1 * * * *', async () => {

    try {
      const date = moment(new Date(Date.now())).format("MM/D/YYYY h:mm:ss +00:00");
      const eventIds     = await Events.distinct('Id',{ 
        sportsId: '2',
        winner: 0,
        openDate : {$lt: date}
        // inplay: true
      });
      console.log("Total event Id = ", eventIds.length);
      if(eventIds.length > 0){
        await addInPlayFalse(eventIds)
      }
    } catch(error){
      console.error('Error running listMarket cron job:', error);
    }
  });
}
tennis()

