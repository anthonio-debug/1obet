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
      // There are 2 formats for  Date Month without 0 M is (7) & month with zero MM (07)
      const date  = moment(new Date(Date.now() - 2 *    60 * 60 * 1000)).format("M/DD/YYYY h:mm:ss +00:00");
      const date2 = moment(new Date(Date.now() - 2 *    60 * 60 * 1000)).format("MM/DD/YYYY h:mm:ss +00:00");
      const eventIds1     = await Events.distinct('Id',{ 
        sportsId: '1',
        openDate : {$lt: date2},
        inplay: true
      });
      const eventIds2     = await Events.distinct('Id',{ 
        sportsId: '1',
        openDate : {$lt: date},
        inplay: true
      });
      const eventIds      = eventIds1.concat(eventIds2)
      console.log("Total event Id = ", eventIds.length);
      await addInPlayFalse(eventIds)
    } catch(error){
      console.error('Error running listMarket cron job:', error);
    }
  });
}
cricketOldEvent()

