const axios = require('axios');
const config = require('config');
const Racing = require('./app/models/racing');
const Event = require('./app/models/events');
require('./db');
// mongooseConnection.set('bufferTimeoutMS', 30000);

// async function todayRaceJob(sportsId) {
//   try {
//     const url = `${config.horseRaceUrl}/meetings/today/${sportsId}`;
//     const response = await axios.get(url);
//     const meetings = response.data.meetings;
//     let races = [];
//     meetings.map((meeting)=>{
//       meeting.races.map((race)=>{
//         race.openDate         = race.startTime;
//         race.meetingId        = meeting.meetingId;
//         race.meetingName      = meeting.name;
//         race.countryCode      = meeting.countryCode;
//         race.meetingOpenDate  = meeting.openDate;
//         race.venue            = meeting.venue;
//         race.meetingGoing     = meeting.meetingGoing;
//         races.push(race)
//       });
//     });
//     console.log(races);


//     // update: 'ok',
//     // marketId: '1.216489102',
//     // raceId: '32516747.1245',
//     // marketName: '5f Mdn Stks',
//     // marketType: null,
//     // numberOfWinners: 1,
//     // numberOfRunners: 7,
//     // numberOfActiveRunners: 0,
//     // startTime: '2023-07-30T12:45:00+00:00',
//     // result: false,
//     // raceNumber: 'R1',
//     // inplay: true,
//     // status: 'OPEN',
//     // openDate: '2023-07-30T12:45:00+00:00',
//     // meetingId: 32516747,
//     // meetingName: 'Pontefract 30th Jul',
//     // countryCode: 'GB',
//     // meetingOpenDate: '2023-07-30T12:45:00+00:00',
//     // venue: 'Pontefract',
//     // meetingGoing: 'Good to Soft'

  
//     // const bulkOperations = [];
//     // for (let data of horseRacesData.meetings) {
//     //   let marketIdsArray = []
//     //   await data.races.forEach((element) => marketIdsArray.push(element.marketId));
//     //   let obj = {}
//     //   obj.races = data.races 
//     //   obj.meetingId = data.meetingId 
//     //   obj.venue = data.venue 
//     //   obj.sportsId = `${data.eventTypeId}` 
//     //   obj.countryCode = data.countryCode 
//     //   obj.countryCodes = horseRacesData.countryCodes 
//     //   obj.meetingGoing = data.meetingGoing
//     //   obj.openDate = data.openDate
//     //   obj.marketIds = marketIdsArray
//     //   bulkOperations.push({
//     //     updateOne: {
//     //       filter: { meetingId: data.meetingId },
//     //       update: { $setOnInsert: obj },
//     //       upsert: true,
//     //     },
//     //   });
//     // }
//     // console.log('Data', bulkOperations)
//     // Perform bulk write operation
//     // await inPlayEvents.bulkWrite(bulkOperations, { ordered: false });

//     // return ({
//     //   success: true,
//     //   message: 'Horse Race Records',
//     //   results: horseRacesData,
//     // });
//   } catch (error) {
//     console.error(error);
//     return {
//       success: false,
//       message: 'Failed to get or save inplay events',
//       error: error.message,
//     };
//   }
// }



async function todayRaceJob(sportsId) {
  try {
    const url = `${config.horseRaceUrl}/meetings/today/${sportsId}`;
    const response = await axios.get(url);
    const meetings = response.data.meetings;
    let racesBulkOperation = [];
    let races  = [];
    meetings.map((meeting)=>{
      meeting.races.map((race)=>{
        race.Id               = race.raceId;
        race.marketIds        = [race.marketId];
        race.openDate         = race.startTime;
        race.meetingId        = meeting.meetingId;
        race.meetingName      = meeting.name;
        race.countryCode      = meeting.countryCode;
        race.meetingOpenDate  = meeting.openDate;
        race.venue            = meeting.venue;
        race.meetingGoing     = meeting.meetingGoing;
        race.sportsId         = sportsId;
        races.push(race);
        racesBulkOperation.push({
          updateOne: {
            filter: { Id: race.Id },
            update: { $set: race },
            upsert: true,
          },
        });
      });
    });   
    console.log(races);
    await Event.bulkWrite(racesBulkOperation);
    return ({
      success: true,
      message: 'Race Records list',
      results: races,
    });
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: 'Failed to get or save inplay events',
      error: error.message,
    };
  }
}


todayRaceJob("7")