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
          status: "CLOSED"
        }}
        );
    }
    console.log("response>>>>>>>>>>>>>", response.data);
  });


}

const cricketOldEvent = () => {
  cron.schedule('*/1 * * * *', async () => {
    try {
      // const date2 = moment(new Date(Date.now() - 2 *    60 * 60 * 1000)).format("MM/DD/YYYY h:mm:ss +00:00");
      const eventId  = await Events.distinct('Id',{ 
        sportsId: '4',
        inplay: true
      });
      console.log("Total event Id = ", eventIds.length);
      await addInPlayFalse(eventIds)
    } catch(error){
      console.error('Error running listMarket cron job:', error);
    }
  });
}
cricketOldEvent()

