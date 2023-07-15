const express = require('express');
let config = require('config');
const axios = require('axios');
const ListCompetitions = require('../models/listCompetitions');
const Event = require('../models/eventsBySport');
const ListMarket = require('../models/listMarkets');
const Odds = require('../models/odds');
const inPlayEvents = require('../models/events');
const rateLimit = require('express-rate-limit');
const fancyGames = require('../models/fancyGames')

// Limit each IP to 60 requests per minute
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many requests from this IP, please try again later',
});

const loginRouter = express.Router();

async function listCompetitions(req, res) {
  const sportId = req.params.sportId;
  const url = `${config.sportsAPIUrl}/listCompetitions/${sportId}`;

  try {
    const response = await axios.get(url);
    const competitionData = response.data;

    // Create an array to store the created Competition documents
    const competitions = [];

    // Iterate over the competitionData array and create a new Competition document for each competition
    for (const data of competitionData) {
      const existingCompetition = await ListCompetitions.findOne({
        Id: data.Id,
        sportsId: sportId,
      });

      if (existingCompetition) {
        competitions.push(existingCompetition);
      } else {
        const competition = new ListCompetitions({
          Id: data.Id,
          Name: data.Name,
          sportsId: sportId,
        });

        // Save the document to the database
        await competition.save();

        competitions.push(competition);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Competitions retrieved and saved successfully',
      competitions: competitions,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to retrieve and save competitions',
      error: error.message,
    });
  }
}

async function listEventsBySport(req, res) {
  const sportId = req.params.sportId;

  try {
    const response = await axios.get(
      `${config.sportsAPIUrl}/listEventsBySport/${sportId}`
    );
    console.log('response', response.data);
    const eventsData = response.data;
    const events = [];

    for (const eventData of eventsData) {
      const filter = { Id: eventData.Id, sportsId: sportId,  type: 2 };
      const update = {
        $setOnInsert: {
          sport: eventData.sport,
          competitionId: eventData.competitionId,
          competitionName: eventData.competitionName,
          Id: eventData.Id,
          name: eventData.name,
          countryCode: eventData.countryCode,
          timezone: eventData.timezone,
          openDate: new Date(eventData.openDate),
          inplay: eventData.inplay,
          hasFancy: eventData.hasFancy,
          status: eventData.status,
          isPremium: eventData.isPremium,
          sportsId: sportId,
          type: 2
        },
      };

      const options = { upsert: true, new: true };

      const updatedEvent = await inPlayEvents.findOneAndUpdate(
        filter,
        update,
        options
      );
      events.push(updatedEvent);
    }

    if (res) {
      res.json({
        success: true,
        message: 'Events retrieved successfully',
        events: events,
      });
    }
  } catch (error) {
    console.error(error);
    if (res) {
      res.json({
        success: false,
        message: 'Failed to get events',
        error: error.message,
      });
    }
  }
}


//Id is eventId
async function listEventsByCompetition(req, res) {
  const { sportId, competId } = req.params;
  const url = `${config.sportsAPIUrl}/listEventsByCompetition/${sportId}/${competId}`;

  try {
    const response = await axios.get(url);
    const events = response.data;
    const { errorCode, errorDescription } = response.data;

    if (errorCode === 1 && errorDescription === 'No data found') {
      throw new Error('No events found');
    }
    const savedEvents = [];

    for (const event of events) {
      const filter = { sportsId: sportId, Id: event.Id, type: "eventsByCompetitions" };
      const update = { $set: { sportsId: sportId, type: "eventsByCompetitions" }, ...event };
      const options = { upsert: true, new: true };

      const savedEvent = await Event.findOneAndUpdate(
        filter,
        update,
        options
      );
      savedEvents.push(savedEvent);
    }

    res.status(200).json({
      success: true,
      message: 'Events retrieved and saved successfully',
      events: savedEvents,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      error: error.message,
    });
  }
}

async function listInplayEvents(req, res) {
  const sportsId = req.params.sportsId;
  const url = `${config.sportsAPIUrl}/listInplayEvents/${sportsId}`;

  try {
    const response = await axios.get(url);
    const inplayEvents = response.data;
    // Save the inplayEvents data to the collection
    const savedEvents = [];

    for (const event of inplayEvents) {
      const matchType = getMatchType(event); // Get the match type based on the event
      event['matchType'] = matchType; // Add the matchType field to the event
      const filter = { sportsId: sportsId, Id: event.Id, type: 1 };
      const update = { $set: { sportsId: sportsId, type: 1 }, $setOnInsert: event };
      const options = { upsert: true, new: true };

      const savedEvent = await inPlayEvents.findOneAndUpdate(
        filter,
        update,
        options
      );
      savedEvents.push(savedEvent);
    }

    res.status(200).json({
      success: true,
      message: 'Inplay events retrieved and saved successfully',
      inplayEvents: savedEvents,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get or save inplay events',
      error: error.message,
    });
  }
}

function getMatchType(event) {
  const name = event.name || '';
  const competitionName = event.competitionName || '';

  switch (true) {
    case name.includes('T20') || name.includes('t20') || name.includes('Twenty20') || competitionName.includes('T20') || competitionName.includes('Twenty20'):
      return 'T20';
    case name.includes('ODI') || name.includes('odi') || name.includes('one day') || name.includes('one Day') || competitionName.includes('ODI') || competitionName.includes('one day') || competitionName.includes('one Day') || competitionName.includes('odi'):
      return 'ODI';
    case name.includes('T10') || name.includes('t10') || name.includes('ten10') || name.includes('Ten10') || competitionName.includes('T10') || competitionName.includes('t10') || competitionName.includes('ten10') || competitionName.includes('Ten10'):
      return 'T10';
    case name.includes('Test') || name.includes('test') || competitionName.includes('Test') || competitionName.includes('test'):
      return 'TEST';
    default:
      return '';
  }
}

async function getOdds(req, res) {
  // Apply rate limiting middleware to the API
  // limiter(req, res, async () => {
    // marketIds can be more than 20, but only takes the first 20 market IDs in the request:
    const marketIds = req.query.ids
    // .split(',').slice(0, 20);

    try {
      const url = `${config.sportsAPIUrl}/odds/?ids=${marketIds}`;
      const response = await axios.get(url);

      const oddsData = response.data;

      for (const data of oddsData) {

        const market = await ListMarket.findOne({ marketId: data.MarketId });

        if (market) {
          await Odds.findOneAndUpdate(
            { eventId: data.eventId, marketId: data.MarketId },
            {
              $set: {
                updatetime: data.updatetime,
                update: data.update,
                sport: data.sport,
                eventId: data.eventId,
                marketId: data.MarketId,
                marketName: data.marketName,
                source: data.source,
                isMarketDataDelayed: data.IsMarketDataDelayed,
                status: data.Status,
                isInplay: data.IsInplay,
                inplay: data.inplay,
                numberOfRunners: data.NumberOfRunners,
                numberOfActiveRunners: data.NumberOfActiveRunners,
                totalMatched: data.TotalMatched,
                sportsId: market.sportsId,
                runners: data.Runners,
              },
            },
            { upsert: true, new: true }
          );
        }
      }

      res.status(200).json({
        success: true,
        message: 'Odds retrieved and saved successfully',
        odds: oddsData,
      });
    } catch (error) {
      console.error(error);
      res.status(200).json({
        success: false,
        message: 'Failed to get or save odds',
        error: error.message,
      });
    }
  // });
}

async function listMarkets(req, res) {
  const eventId = req.params.eventId;
  const url = `${config.sportsAPIUrl}/listMarkets/${eventId}`;

  try {
    const response = await axios.get(url);
    const marketsData = response.data;
    const markets = [];

    // Get the event details from the eventsByCompetition model
    const eventDetails = await inPlayEvents.find({ Id: eventId });
    for (const marketData of marketsData) {
      const runners = marketData.runners.map((runnerData) => ({
        selectionId: runnerData.selectionId,
        runnerName: runnerData.runnerName,
      }));

      const filter = {
        marketId: marketData.marketId,
        eventId: eventId,
        sportsId: eventDetails[0].sportsId,
      };
      const update = {
        Updatetime: marketData.Updatetime,
        marketName: marketData.marketName,
        totalMatched: marketData.totalMatched,
        status: marketData.status,
        runners: runners,
        eventId: eventId,
        sportsId: eventDetails[0].sportsId
      };
      const options = { upsert: true, new: true };

    //   // Update or create the market in the ListMarket model
      const savedMarket = await ListMarket.findOneAndUpdate(
        filter,
        update,
        options
      );
      markets.push(savedMarket);
    }

    res.status(200).json({
      success: true,
      message: 'Markets retrieved and saved successfully',
      markets: marketsData,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get or save markets',
      error: error.message,
    });
  }
}

async function getnewOdds(ids) {
  // Apply rate limiting middleware to the API
  // limiter(req, res, async () => {
    // marketIds can be more than 20, but only takes the first 20 market IDs in the request:
    // .split(',').slice(0, 20);

    try {
      const url = `${config.sportsAPIUrl}/odds/?ids=${ids}`;
      const response = await axios.get(url);
    
      const oddsData = response.data;

      for (const data of oddsData) {

        const market = await ListMarket.find({ marketId: data.MarketId });
          await Odds.updateMany(
            { eventId: data.eventId, marketId: data.MarketId },
            {
              $set: {
                updatetime: data.updatetime,
                update: data.update,
                sport: data.sport,
                eventId: data.eventId,
                marketId: data.MarketId,
                marketName: data.marketName,
                source: data.source,
                isMarketDataDelayed: data.IsMarketDataDelayed,
                status: data.Status,
                isInplay: data.IsInplay,
                inplay: data.inplay,
                numberOfRunners: data.NumberOfRunners,
                numberOfActiveRunners: data.NumberOfActiveRunners,
                totalMatched: data.TotalMatched,
                sportsId: market.sportsId,
                runners: data.Runners
              },
            },
            { upsert: true, new: true }
          );
        }

      return({
        success: true,
        message: 'Odds retrieved and saved successfully',
        odds: oddsData,
      });
    } catch (error) {
      console.error(error);
      return({
        success: false,
        message: 'Failed to get or save odds',
        error: error.message,
      });
    }
  // });
}

async function listInplayEventsJob(sportsId) {
  const url = `${config.sportsAPIUrl}/listEventsBySport/${sportsId}`;

  try {
    const response = await axios.get(url);
    const inplayEvents = response.data;

    // Save the inplayEvents data to the collection
    const savedEvents = [];

    for (const event of inplayEvents) {
      const filter = { sportsId: sportsId, Id: event.Id };
      const update = { $set: { sportsId: sportsId }, $setOnInsert: event };
      const options = { upsert: true, new: true };

      const savedEvent = await inPlayEvents.findOneAndUpdate(
        filter,
        update,
        options
      );
      savedEvents.push(savedEvent);
    }

    return({
      success: true,
      message: 'Inplay events retrieved and saved successfully',
      inplayEvents: savedEvents,
    });
  } catch (error) {
    console.error(error);
    return({
      success: false,
      message: 'Failed to get or save inplay events',
      error: error.message,
    });
  }
}

async function listMarketsByCronJob(eventId) {
  const url = `${config.sportsAPIUrl}/listMarkets/${eventId}`;

  try {
    const response = await axios.get(url);
    const marketsData = response.data;
    const markets = [];

    // Get the event details from the eventsByCompetition model
    const eventDetails = await inPlayEvents.find({ Id: eventId });
    console.log('eventDetails',eventDetails.sportsId);
    for (const marketData of marketsData) {
      console.log('marketData',marketData.status);
      const runners = marketData.runners.map((runnerData) => ({
        selectionId: runnerData.selectionId,
        runnerName: runnerData.runnerName,
      }));

      const filter = {
        marketId: marketData.marketId,
        eventId: eventId,
        sportsId: eventDetails.sportsId,
      };
      const update = {
        Updatetime: marketData.Updatetime,
        marketName: marketData.marketName,
        totalMatched: marketData.totalMatched,
        status: marketData.status,
        runners: runners,
        eventId: eventId,
        sportsId: eventDetails.sportsId
      };
      const options = { upsert: true, new: true };

    //   // Update or create the market in the ListMarket model
      const savedMarket = await ListMarket.findOneAndUpdate(
        filter,
        update,
        options
      );
      markets.push(savedMarket);
    }
    return({
      success: true,
      message: 'Markets retrieved and saved successfully',
      marketsData,
    });
  } catch (error) {
    console.error(error);
    return({
      success: false,
      message: 'Failed to get or save markets',
      error: error.message,
    });
  }
}

// async function fancyDataByCronjob(eventId) {
//   const url = `${config.fancyUrl}/bm_fancy/${eventId}`;
//   console.log('url', url);
//   try {
//     const response = await axios.get(url);
//     const fancyData = response?.data;
//     // const dummyDataofFancy = {
//     //   gameId: '32480285',
//     //   eventId: '32480285',
//     //   eventName: 'India A v United Arab Emirates / Jul 14 2023 10:00AM (IST)',
//     //   eventTypeId: '4',
//     //   eventTypeName: 'cricket',
//     //   name: 'India A v United Arab Emirates',
//     //   status: 200,
//     //   success: true,
//     //   t1: null,
//     //   t2: [
//     //     {
//     //       bm1: [
//     //         {
//     //           mid: '1.216004572',
//     //           mname: 'Bookmaker',
//     //           remark: '',
//     //           remark1: '',
//     //           min: '100.00',
//     //           max: '100000.00',
//     //           sid: '1',
//     //           nat: 'India A ',
//     //           b1: '0.75',
//     //           bs1: '100000.00',
//     //           l1: '1.25',
//     //           ls1: '100000.00',
//     //           s: 'ACTIVE',
//     //           sr: '1',
//     //           gtype: 'Match1',
//     //           utime: '0',
//     //           b2: '0.00',
//     //           bs2: '0.00',
//     //           b3: '0.00',
//     //           bs3: '0.00',
//     //           l2: '0.00',
//     //           ls2: '0.00',
//     //           l3: '0.00',
//     //           ls3: '0.00',
//     //           b1s: 'True',
//     //           b2s: 'False',
//     //           b3s: 'False',
//     //           l1s: 'True',
//     //           l2s: 'False',
//     //           l3s: 'False'
//     //         },
//     //         {
//     //           mid: '1.216004572',
//     //           mname: 'Bookmaker',
//     //           remark: '',
//     //           remark1: '',
//     //           min: '100.00',
//     //           max: '100000.00',
//     //           sid: '2',
//     //           nat: 'United Arab Emirates',
//     //           b1: '0.00',
//     //           bs1: '0.00',
//     //           l1: '0.00',
//     //           ls1: '0.00',
//     //           s: 'SUSPENDED',
//     //           sr: '2',
//     //           gtype: 'Match1',
//     //           utime: '0',
//     //           b2: '0.00',
//     //           bs2: '0.00',
//     //           b3: '0.00',
//     //           bs3: '0.00',
//     //           l2: '0.00',
//     //           ls2: '0.00',
//     //           l3: '0.00',
//     //           ls3: '0.00',
//     //           b1s: 'False',
//     //           b2s: 'False',
//     //           b3s: 'False',
//     //           l1s: 'False',
//     //           l2s: 'False',
//     //           l3s: 'False'
//     //         }
//     //       ],
//     //       bm2: []
//     //     }
//     //   ],
//     //   t3: [
//     //     {
//     //       mid: '1.216004572',
//     //       sid: '268',
//     //       nat: '15 over run IND A',
//     //       b1: '81.00',
//     //       bs1: '85.00',
//     //       l1: '81.00',
//     //       ls1: '115.00',
//     //       b2: '0.00',
//     //       bs2: '0.00',
//     //       l2: '0.00',
//     //       ls2: '0.00',
//     //       b3: '0.00',
//     //       bs3: '0.00',
//     //       l3: '0.00',
//     //       ls3: '0.00',
//     //       gtype: 'Fancy',
//     //       utime: '0',
//     //       gvalid: '0',
//     //       gstatus: '',
//     //       remark: '',
//     //       min: '100.00',
//     //       max: '100000.00',
//     //       srno: '1',
//     //       s1: '0',
//     //       s2: '0',
//     //       ballsess: '1'
//     //     },
//     //     {
//     //       mid: '1.216004572',
//     //       sid: '266',
//     //       nat: '14 over run IND A',
//     //       b1: '0.00',
//     //       bs1: '0.00',
//     //       l1: '0.00',
//     //       ls1: '0.00',
//     //       b2: '0.00',
//     //       bs2: '0.00',
//     //       l2: '0.00',
//     //       ls2: '0.00',
//     //       b3: '0.00',
//     //       bs3: '0.00',
//     //       l3: '0.00',
//     //       ls3: '0.00',
//     //       gtype: 'Fancy',
//     //       utime: '0',
//     //       gvalid: '1',
//     //       gstatus: 'SUSPENDED',
//     //       remark: '',
//     //       min: '100.00',
//     //       max: '50000.00',
//     //       srno: '2',
//     //       s1: '0',
//     //       s2: '0',
//     //       ballsess: '1'
//     //     },
//     //     {
//     //       mid: '1.216004572',
//     //       sid: '265',
//     //       nat: '13.3 over run IND A',
//     //       b1: '0.00',
//     //       bs1: '0.00',
//     //       l1: '0.00',
//     //       ls1: '0.00',
//     //       b2: '0.00',
//     //       bs2: '0.00',
//     //       l2: '0.00',
//     //       ls2: '0.00',
//     //       b3: '0.00',
//     //       bs3: '0.00',
//     //       l3: '0.00',
//     //       ls3: '0.00',
//     //       gtype: 'Fancy',
//     //       utime: '0',
//     //       gvalid: '1',
//     //       gstatus: 'Ball Running',
//     //       remark: '',
//     //       min: '100.00',
//     //       max: '50000.00',
//     //       srno: '2',
//     //       s1: '0',
//     //       s2: '0',
//     //       ballsess: '1'
//     //     }
//     //   ],
//     //   t4: null,
//     //   updatetime: '2023-07-14T09:50:03.462Z'
//     // }
  
//   const bookMakerData = fancyData?.data?.t2;
//   // console.log('bookMakerData', bookMakerData)
//   let arrayOfBookMaker = {BookMaker: [{marketName: 'BookMaker', runners: []}]}

//   if(bookMakerData?.length) {
//     const dataofbm1  = bookMakerData[0]?.bm1;
//     // console.log('sfsdfsdfsdf', dataofbm1)
//     const dummyArray = []
//     dataofbm1?.forEach((item)=>{         
//       const AvailableToBackObj = [{
//         price: Number(item?.b1),
//         size: Number(item?.bs1)
//       },
//       {
//         price:Number(item?.b2),
//         size: Number(item?.bs2) 
//       },
//       {
//         price:Number(item?.b3),
//         size: Number(item?.bs3) 
//       },
//     ]
//     const AvailableToLayObj = [{
//       price: Number(item?.l1),
//       size: Number(item?.ls1)
//     },
//     {
//       price: Number(item?.l2),
//       size: Number(item?.ls2)
//     },
//     {
//       price: Number(item?.l3),
//       size: Number(item?.ls3) 
//     },
//   ]
//   const ExchangePricesObj = {AvailableToBack: AvailableToBackObj, AvailableToLay:AvailableToLayObj }
//   const dummyObj = {...item, runnerName: item?.nat, ExchangePrices:ExchangePricesObj}
// dummyArray.push(dummyObj)
//     })
//     arrayOfBookMaker['BookMaker'][0]['runners'] = dummyArray
//   }
//   console.log('arrayofbookermaeeeeee',arrayOfBookMaker['BookMaker'][0].runners);
//     // Create a new fancyData document
//     const newData = {
//       t1: fancyData?.data?.t1,
//       t2: bookMakerData,
//       t3: fancyData?.data?.t3,
//       t4: fancyData?.data?.t4,
//       success: fancyData?.success,
//       status: fancyData?.status,
//       updatetime: fancyData?.updatetime,
//       eventTypeId: fancyData?.eventTypeId,
//       eventTypeName: fancyData?.eventTypeName,
//       eventName: fancyData?.eventName,
//       name: fancyData?.name,
//       eventdate: fancyData?.eventdate,
//       gameId: fancyData?.gameId,
//       eventId: eventId
//     };

//     // Update or insert the document in the database
//     const result = await fancyGames.findOneAndUpdate(
//       { gameId: eventId },
//       newData,
//       { upsert: true }
//     );

//     return {
//       success: true,
//       message: 'Fancy data saved successfully',
//       fancyData: newData,
//       BookMakerData: arrayOfBookMaker
//     };
//   } catch (error) {
//     console.error(error);
//     return {
//       success: false,
//       message: 'Failed to save fancy data',
//       error: error.message
//     };
//   }
// }
async function fancyDataByCronjob(eventId) {
  const url = `${config.fancyUrl}/bm_fancy/${eventId}`;
  console.log('url', url);
  try {
    const response = await axios.get(url);
    const fancyData = response?.data;
   // Create a new fancyData document
  const  newData = {
    t1: fancyData?.data?.t1,
    t2: fancyData?.data?.t2,
    t3: fancyData?.data?.t3,
    t4: fancyData?.data?.t4,
    success: fancyData?.success,
    status: fancyData?.status,
    updatetime: fancyData?.updatetime,
    eventTypeId: fancyData?.eventTypeId,
    eventTypeName: fancyData?.eventTypeName,
    eventName: fancyData?.eventName,
    name: fancyData?.name,
    eventdate: fancyData?.eventdate,
    gameId: fancyData?.gameId,
    eventId: eventId
  };

    // Update or insert the document in the database
    const result = await fancyGames.findOneAndUpdate(
      { gameId: eventId },
      newData,
      { upsert: true }
    );
      return({
        success: true,
        message: 'Fancy data saved successfully',
        fancyData: newData,
      });
  } catch (error) {
    console.error(error);
    return({
      success: false,
      message: 'Failed to save fancy data',
      error: error.message,
    });
  }
}

loginRouter.get('/listCompetition/:sportId', listCompetitions);
loginRouter.get('/listEventBySport/:sportId', listEventsBySport);
loginRouter.get(
  '/listEventByCompetition/:sportId/:competId',
  listEventsByCompetition
);
loginRouter.get('/listMarket/:eventId', listMarkets);
loginRouter.get('/listInplayEvent/:sportsId', listInplayEvents);
loginRouter.get('/getOdds', getOdds);

module.exports = { loginRouter,getOdds, getnewOdds,listInplayEventsJob,fancyDataByCronjob, listEventsBySport,listInplayEvents,listEventsByCompetition,listMarketsByCronJob };
