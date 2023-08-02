const cron    = require("node-cron");
const axios   = require('axios');
const config  = require('config');
const Events  = require('../../app/models/events');
const moment  = require('moment');
require('../../db');

const addInPlayFalse = async (eventIds)=>{
  eventIds.map(async (eventId)=>{
    const event     = await Events.findOne({
      Id:eventId
    });
    const url = `${config.horseRaceUrl}/results/?ids=${event.marketIds[0]}`;
    const response = await axios.get(url);
    if(response?.data.length > 0 ){
      await Events.findOneAndUpdate(
        {Id:String(eventId)},
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
      // const date  = moment(new Date(Date.now() - 10 * 60 * 1000)).format("YYYY-MM-DDThh:mm:ss+00:00");
      const eventIds     = await Events.distinct('Id',{ 
        sportsId: '7',
        // openDate : {$lt: date},
        inplay: true
      });
      console.log("Total event Ids = ", eventIds.length);
      await addInPlayFalse(eventIds)
    } catch(error){
      console.error('Error running listMarket cron job:', error);
    }
  });
}

cricketOldEvent()

