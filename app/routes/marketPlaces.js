const express = require('express');
const { validationResult } = require('express-validator');
const MarketType = require('../models/marketTypes');
const SubMarketType = require('../models/subMarketTypes');
const MarketIDS = require('../models/marketIds');
const User = require('../models/user');
const { v4: uuidv4 } = require('uuid');
const marketPlaceVlidator = require('../validators/marketPlaces');
const inPlayEvents = require('../models/events');
const { fetchMarket } = require('../../helper/eventHelper');
const Odds = require('../models/odds');
const axios = require('axios');


const router = express.Router();
const loginRouter = express.Router();

function addMarketType(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const marketType = new MarketType(req.body);
  marketType.marketId = uuidv4();
  marketType.save((err, marketType) => {
    if (err && err.code == 11000) {
      if (err.keyPattern.name == 1) return res.status(404).send({ message: 'market type already present' });
    }
    if (err || !marketType) {
      return res.status(404).send({ message: 'market type not added', err });
    }
    return res.send({
      success: true,
      message: 'Market type added successfully',
      results: marketType
    });
  });
}

async function updateMarketStatusInPlay(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    const { checked, eventId, marketId } = req.body;
    const status = checked ? 'OPEN' : 'CLOSED';
    const inPlay = !!checked;
    await MarketIDS.updateOne({ eventId: eventId, marketId: marketId }, { inPlay: inPlay, status: status });
    return res.status(200).send({
      success: true,
      message: 'Updated successfully !'
    });
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by MarketId'
    });
  }
}

function addSubMarketTypes(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  MarketType.findOne({ marketId: req.body.marketId }, (err, data) => {
    if (err) return res.status(404).send({ message: 'market type not found', err });
    const subMarketType = new SubMarketType(req.body);
    subMarketType.marketId = data.marketId;
    subMarketType.subMarketId = uuidv4(); // Generate a unique UUID
    subMarketType.save((err, marketType) => {
      if (err && err.code == 11000) {
        if (err.keyPattern.name == 1) return res.status(404).send({ message: 'sub market type already present' });
      }
      if (err || !marketType) {
        return res.status(404).send({ message: 'sub market type not added', err });
      }
      return res.send({
        success: true,
        message: 'Sub Market type added successfully',
        results: marketType
      });
    });
  });
}

async function getAllMarketTypes(req, res) {
  User.findOne({ userId: req.decoded.userId }, async (err, user) => {
    if (err || !user) {
      return res.status(404).send({ message: 'Something went wrong' });
    }
    const blockedMarkets = user.blockedMarketPlaces;
    const blockedSubMarkets = user.blockedSubMarkets;

    const data = await MarketType.aggregate([
      {
        $lookup: {
          from: 'submarkettypes',
          localField: 'Id',
          foreignField: 'marketId',
          as: 'subMarkets'
        }
      },
      {
        $project: {
          Id: '$Id',
          marketName: '$name',
          status: {
            $cond: {
              if: { $in: ['$Id', blockedMarkets] },
              then: 0,
              else: 1
            }
          },
          subMarkets: {
            $map: {
              input: '$subMarkets',
              as: 'subMarket',
              in: {
                Id: '$$subMarket.Id',
                name: '$$subMarket.name',
                marketId: '$$subMarket.marketId',
                status: {
                  $cond: {
                    if: { $in: ['$$subMarket.Id', blockedSubMarkets] },
                    then: 0,
                    else: 1
                  }
                }
              }
            }
          }
        }
      }
    ]);

    return res.send({
      success: true,
      message: 'MARKET_TYPES_FETCHED_SUCCESSFULLY',
      results: {
        markets: data,
        blockedMarkets,
        blockedSubMarkets
      }
    });
  });
}

async function getMarketsBySportsId(req, res) {
  try {
    const sportsId = req.params.sportsId;
    const marketData = await MarketIDS.aggregate([
      {
        $match: { sportID: parseInt(sportsId, 10) }
      },
      {
        $lookup: {
          from: 'inplayevents',
          localField: 'eventId',
          foreignField: 'Id',
          as: 'eventDetails'
        }
      },
      {
        $unwind: '$eventDetails'
      },
      {
        $project: {
          _id: 1,
          sportID: 1,
          eventId: 1,
          eventName: '$eventDetails.name',
          marketId: 1,
          marketName: 1,
          status: 1
        }
      }
    ]);

    res.status(200).json({ success: true, data: marketData });
  } catch (err) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by SportsId'
    });
  }
}

async function getMarketsByEventId(req, res) {
  try {
    const eventId = req.params.eventId;
    const marketData = await MarketIDS.aggregate([
      {
        $match: { eventId: eventId }
      },
      {
        $lookup: {
          from: 'odds',
          localField: 'marketId',
          foreignField: 'marketId',
          as: 'oddsData'
        }
      },
      {
        $project: {
          _id: 1,
          sportID: 1,
          eventId: 1,
          marketId: 1,
          marketName: 1,
          status: 1,
          totalMatched: { $arrayElemAt: ['$oddsData.totalMatched', 0] }
        }
      }
    ]);

    res.status(200).json({ success: true, data: marketData });
  } catch (err) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by EventId'
    });
  }
}

async function activateEvent(req, res) {
  try {
    const eventId = req.params.eventId;
    const event = await inPlayEvents.findOne({ Id: eventId });
    event.status = 'OPEN';
    event.CompanySetStatus = 'OPEN';
    event.isShowed = true;
    event.lastCheckMarket = Date.now();
    await event.save();
    await fetchMarket(event);

    res.status(200).json({ success: true, message: 'Event updated successfully' });
  } catch (err) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by EventId'
    });
  }
}

////////////////////////////mmmmmmmmmmmmmmmmm
async function saveOdds(oddData, sportsId) {
  try {
    oddData = JSON.parse(oddData);
} catch (error) {
    console.error("Failed to parse oddData:", error);
    return;
}
  const runners = [];

  for (const runner of oddData.runners) {
    runners.push({
      SelectionId: runner.selectionId,
      runnerName: runner.runner,
      Status: runner.status,
      LastPriceTraded: runner.lastPriceTraded,
      TotalMatched: 0,
      ExchangePrices: {
        AvailableToBack: runner.back,
        AvailableToLay: runner.lay,
      },
    });
  }

  const activeRunners = runners.filter((e) => e.Status === "ACTIVE");
       const response= await Odds.findOne({marketId: oddData.marketId})
       let odd;
       if (!response){
         odd = {
          eventId: oddData.eventid,
          marketId: oddData.marketId,
          status: oddData.status,
          isInplay: oddData.inplay,
          totalMatched: oddData.totalMatched,
          isMarketDataDelayed: false,
          sportsId,
          numberOfRunners: runners.length,
          numberOfActiveRunners: activeRunners.length,
          runners,
        };
        
        const odds = new Odds(odd);
        await odds.save();
       }else{
            console.log("+_+_+_+_+___+_+_+_   == updating odds")
            await Odds.findOneAndUpdate({marketId: oddData.marketId},{$set:{totalMatched:oddData.totalMatched}})
            console.log("+_+_++_+_+_+_+_+_+_+_ odds uptdation completed");
            
        }

  return odd;
}

///get odds

async function getOdds(marketIds, sportsId) {
  return new Promise(async (resolve, reject) => {
    const odds = [];
    const oddUrl = `http://84.8.153.51/api/v2/getMarketsOdds?EventTypeID=${sportsId}&marketId=${marketIds}`;
    // const oddUrl = `http://84.8.153.51/api/v2/getMarketsOdds?EventTypeID=4&marketId=${marketIds}`;
    
      const response = await axios.get(oddUrl);
    
    if (response.data) {
      
      const oddData = response.data;
      console.log("===================================================================================2");
      odds.push(await saveOdds(oddData, sportsId));
    }
    resolve(odds);
  });
}

///// cron odds

async function cronOdds2(eventId, sportID) {
  console.log("===================================================================================3");
  console.log(" MMMMMMMMMMM      sportID in cronOdds2 ", sportID);

  const url = `http://84.8.153.51/api/v2/getMarkets?EventTypeID=${sportID}&EventID=${eventId}`;
  const bookmakerUrl = `http://sportzing.in:5505/api/getMarketList?match_id=${eventId}`;

  try {
    const response = await axios.get(url);
    const bookmakerResponse = await axios.get(bookmakerUrl);

    console.log("=-=-==-=--=-=-=-=-=-=-=-  response", response.data);
    const bookMakerData = bookmakerResponse.data;
    const marketsData = response.data;
    const sendMarketIds = [];
    const bookmakerMarketIds = [];
    console.log(marketsData, "||||||||||||||||||||");
    const marketStatus = 'OPEN';

    // Handle Market Data
    if (marketsData && marketsData.length > 0) {
      for (const element of marketsData) {
        const tempRunners = element.runners.map(runner => ({
          SelectionId: runner.selectionId,
          runnerName: runner.runnerName,
        }));

        if (element.marketName === 'Match Odds') {
          sendMarketIds.push(element.marketId);

          const marketID = await MarketIDS.findOne({
            eventId: eventId,
            marketId: element.marketId,
          });

          if (!marketID) {
            const newMarket = new MarketIDS({
              eventId: eventId,
              marketId: element.marketId,
              marketName: element.marketName,
              sportID: sportID,
              totalMatched: element.totalMatched,
              openDate: Date.parse(element.marketStartTime),
              status: marketStatus,
              index: 0,
              runners: tempRunners,
              inPlay: true,
            });

            console.log("Saving new market: ", newMarket);
            await newMarket.save();
          } else {
            console.log("{{}{}}{{}{}{}}} updating market id collec for match odds");
            await MarketIDS.findOneAndUpdate(
              { eventId: eventId, marketId: element.marketId },
              { $set: { totalMatched: element.totalMatched } }
            );
          }
        }
      }
    }

    // Handle Bookmaker Data

///////////////////////////////////////////////////
const response1={
  "success": true,
  "data": [
    {
      "marketId": "1.232545946",
      "marketName": "Match Odds",
      "marketStartTime": "2024-09-06T10:00:00.000Z",
      "totalMatched": 613589.47,
      "runners": [
        {
          "selectionId": 10301,
          "runnerName": "England",
          "handicap": 0,
          "sortPriority": 1,
          "metadata": {
            "runnerId": "10301"
          }
        },
        {
          "selectionId": 7337,
          "runnerName": "Sri Lanka",
          "handicap": 0,
          "sortPriority": 2,
          "metadata": {
            "runnerId": "7337"
          }
        },
        {
          "selectionId": 60443,
          "runnerName": "The Draw",
          "handicap": 0,
          "sortPriority": 3,
          "metadata": {
            "runnerId": "60443"
          }
        }
      ],
      "eventType": {
        "id": "4",
        "name": "Cricket"
      },
      "competition": {
        "id": "11365612",
        "name": "Test Matches"
      },
      "event": {
        "id": "33546678",
        "name": "England v Sri Lanka",
        "countryCode": "GB",
        "timezone": "GMT",
        "openDate": "2024-09-06T10:00:00.000Z"
      }
    },
    {
      "marketId": "1.232545953",
      "marketName": "To Win the Toss",
      "marketStartTime": "2024-09-06T10:00:00.000Z",
      "totalMatched": 3898.22,
      "runners": [
        {
          "selectionId": 10301,
          "runnerName": "England",
          "handicap": 0,
          "sortPriority": 1,
          "metadata": {
            "runnerId": "10301"
          }
        },
        {
          "selectionId": 7337,
          "runnerName": "Sri Lanka",
          "handicap": 0,
          "sortPriority": 2,
          "metadata": {
            "runnerId": "7337"
          }
        }
      ],
      "eventType": {
        "id": "4",
        "name": "Cricket"
      },
      "competition": {
        "id": "11365612",
        "name": "Test Matches"
      },
      "event": {
        "id": "33546678",
        "name": "England v Sri Lanka",
        "countryCode": "GB",
        "timezone": "GMT",
        "openDate": "2024-09-06T10:00:00.000Z"
      }
    }
  ]
}




    //////////////////////////////////////////////
    if (response1 && response1.length > 0) {
      for (const element of response1) {
        const bookmakerRunners = element.runners.map(runner => ({
          SelectionId: runner.selectionId,
          runnerName: runner.runnerName,
        }));
        console.log("element.marketName===[[[[[[[[[[[",element.marketName);

        if (element.marketName==="To Win the Toss"){
          sendMarketIds.push(element.marketId)
          console.log("element.marketName===----",element.marketName);
          
        }

        bookmakerMarketIds.push(element.marketId);

        const marketID = await MarketIDS.findOne({
          eventId: eventId,
          marketId: element.marketId,
        });

        if (!marketID) {
          let marketTime= element.marketStartTime
          if (!marketTime){ 
            marketTime=0 
          }else{
            marketTime= Date.parse(marketTime)
          }
          const newBookmakerMarket = new MarketIDS({
            eventId: eventId,
            marketId: element.marketId,
            marketName: element.marketName,
            sportID: sportID,
            totalMatched: element.totalMatched,
            openDate: marketTime,
            status: marketStatus,
            index: 0,
            runners: bookmakerRunners,
            inPlay: true,
          });

          console.log("Saving new bookmaker market: ", newBookmakerMarket);
          await newBookmakerMarket.save();
        } 
        // else {
        //   console.log("Updating market id collection for bookmaker market");
        //   await MarketIDS.findOneAndUpdate(
        //     { eventId: eventId, marketId: element.marketId },
        //     { $set: { totalMatched: element.totalMatched } }
        //   );
        // }
      }
    }

    // Get odds for the standard markets
    let result = [];
    console.log("Sending market ids:", sendMarketIds);
    for (const marketId of sendMarketIds) {
      console.log("===================================================================================5");
      const odds = await getOdds(marketId, sportID);
      result = [...result, ...odds];
    }

    // Get odds for the bookmaker markets
    // console.log("Sending bookmaker market ids:", bookmakerMarketIds);
    // for (const marketId of bookmakerMarketIds) {
    //   const bookmakerOdds = await getOdds(marketId, sportID);
    //   result = [...result, ...bookmakerOdds];
    // }

    res.json({ status: true, data: "Result: ", result });

  } catch (error) {
    console.log({ msg: "Failed to get data. Error: " + error.message });
  }
}



///////////////////////////mmmmmmmmmmmm

async function updateCompanySetStatus(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ message: errors.errors });
  }
  try {
    const data = req.query;
    await inPlayEvents.updateOne({ Id: data.Id }, { CompanySetStatus: data.status });
    const event=await inPlayEvents.findOne({Id:data.Id})


    // console.log("=-=--=-=-=-=--=-=-====-=-= event.sportsId", event.sportsId);
    cronOdds2(data.Id, event.sportsId)

    // console.log("=-=--=-=-=-=--=-=-====-=-= cronOdds2");
    
    return res.status(200).send({
      success: true,
      message: 'Updated successfully !'
    });
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by SportsId'
    });
  }
}

async function updateEventStatus(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ message: errors.errors });
  }
  try {
    const data = req.body;
    const event = await inPlayEvents.countDocuments({ Id: data.Id });
    if (!event) {
      console.warn(`Error: Event not found for ${req.body.Id}`);
      return res.status(400).send({ message: `Event not found ` });
    } else {
      await inPlayEvents.updateOne({ Id: data.Id }, { status: data.status });
      return res.status(200).send({
        success: true,
        message: 'Updated successfully !'
      });
    }
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by SportsId'
    });
  }
}

async function updateEventMarketstatus(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ message: errors.errors });
  }
  try {
    const data = req.body;

    const market = await MarketIDS.countDocuments({ marketId: data.marketId });
    if (!market) {
      console.warn(`Error: market not found for ${data.marketId}`);
      return res.status(400).send({ message: `market not found ` });
    }

    await MarketIDS.updateOne({ marketId: data.marketId }, { status: data.status });
    return res.status(200).send({
      success: true,
      message: 'Updated successfully !'
    });
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by SportsId'
    });
  }
}

async function addAllowedMarketTypes(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    const userId = req.decoded.userId;
    const { markets, subMarkets } = req.body.blocked;

    await User.findOneAndUpdate(
      { userId: userId },
      {
        $set: {
          blockedMarketPlaces: markets,
          blockedSubMarkets: subMarkets
        }
      }
    );
    return res.send({
      success: true,
      message: 'Markets updated successfully'
    });
  } catch (error) {
    console.error(error);
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market types'
    });
  }
}

loginRouter.get('/getAllMarketTypes', getAllMarketTypes);
loginRouter.get('/getMarketsBySportsId/:sportsId', getMarketsBySportsId);
loginRouter.get('/getMarketsByEventId/:eventId', getMarketsByEventId);
loginRouter.post('/addMarketType', addMarketType);
loginRouter.post('/addSubMarketTypes', addSubMarketTypes);
loginRouter.post('/addAllowedMarketTypes', marketPlaceVlidator.validate('addAllowedMarketTypes'), addAllowedMarketTypes);
loginRouter.get('/updatemarketstatus', updateCompanySetStatus);
loginRouter.post('/update-market-status-in-play', updateMarketStatusInPlay);
loginRouter.get('/activate-event/:eventId', activateEvent);
loginRouter.post('/updateEventMarketstatus', updateEventMarketstatus);
loginRouter.post('/updateEventStatus', updateEventStatus);
module.exports = { router, loginRouter };
