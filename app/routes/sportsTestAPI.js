const express = require('express');
const Bets = require("../models/bets")
const Users = require("../models/user")
const InPlayEvents = require("../models/events")
const MarketIDS = require("../models/marketIds")
const Odds = require('../models/odds');
const RaceOdds = require('../models/raceOdds');
const FancyOdds = require('../models/fancyOdds');
const axios = require('axios');
const User = require('../models/user');
const { fetchSession } = require("../../helper/api/sessionAPIHelper");
const router = express.Router();
const apiURL = "http://185.58.225.212:8080/api/"
const apiSystemRacing = require("../../restApiSystem/src/tools_for_updated_racing.js")();
const Session = require('../models/Session');
const inPlayEvents = require('../models/events');
const userBetSizes = require('../models/userBetSizes');
const BetLimits = require('../models/betLimits');

require('dotenv').config()
console.log("haaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

async function listEvents(req, res) {
  try {
    
    const body = {
      "filter": {
        "textQuery": "string",
        "eventTypeIds": [
          "string"
        ],
        "eventIds": [
          "string"
        ],
        "competitionIds": [
          "string"
        ],
        "marketIds": [
          "string"
        ],
        "venues": [
          "string"
        ],
        "bspOnly": true,
        "turnInPlayEnabled": true,
        "inPlayOnly": true,
        "countryCodes": [
          "string"
        ],
        "marketTypes": [
          "string"
        ],
        "timeRange": {
          "from": "2023-11-30T17:01:35.720Z",
          "to": "2023-11-30T17:01:35.720Z"
        }
      }
    }
    const response = await axios.post(`${apiURL}/listEvents`, body)
    res.status(200).json({ success: true, data: response })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get events" })
  }
}

async function listMarketBook(req, res) {
  try {
    const marketIds = req.params.ids
    const response = await axios.get(`${apiURL}listMarketBook/testqms/${marketIds}`)
    let resultArray = [];

    if (response.data.result.length > 0) {
      for (let i = 0; i < response.data.result.length; i++) {
        const odd = {
          marketId: response.data.result[i].marketId,
          runners: response.data.result[i].runners
        }
        resultArray.push(odd)
      }
    }
    res.status(200).json({ success: true, data: resultArray })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get " })
  }
}

async function inActiveUserExposure(req, res) {
  try {
    const stuckUsers = await User.find({ exposure: { $lt: 0 } })
    let newResultArray = [];
    if (stuckUsers.length > 0) {
      for (let i = 0; i < stuckUsers.length; i++) {
        const activeBetCount = await Bets.countDocuments({ userId: stuckUsers[i].userId, status: 1 })
        if (activeBetCount > 0) {
          // stuckUsers.pop(e => e.userId == stuckUsers[i].userId)
          continue;
        } else {
          const inActiveBetCount = await Bets.countDocuments({ userId: stuckUsers[i].userId, status: 0 })
          // //console.log(inActiveBetCount)
          if (inActiveBetCount > 0) {
            //console.log({inActiveBetCount})
            const newData = {
              name: stuckUsers[i].userName,
              userId: stuckUsers[i].userId,
              exposure: stuckUsers[i].exposure,
              betCount: inActiveBetCount
            }
            newResultArray.push(newData)
          } else {
            continue;
          }
        }
      }
    }
    res.status(200).json({ success: true, data: newResultArray })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get " })
  }
}

async function activeUserExposure(req, res) {
  try {
    const stuckUsers = await User.find({ exposure: { $gte: 0.1 } })
    let newResultArray = []
    if (stuckUsers.length > 0) {
      for (let i = 0; i < stuckUsers.length; i++) {
        const activeBetCount = await Bets.countDocuments({ userId: stuckUsers[i].userId, status: 1 })
        if (activeBetCount > 0) {
          stuckUsers[i].BetCount = activeBetCount;
          const newData = {
            name: stuckUsers[i].userName,
            userId: stuckUsers[i].userId,
            exposure: stuckUsers[i].exposure,
            betCount: activeBetCount
          }
          newResultArray.push(newData)
        } else {
          continue;
        }
      }
    }
    res.status(200).json({ success: true, data: newResultArray })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get " })
  }
}

async function betStatisticsByUserId(req, res) {
  const userId = req.params.userId;

  try {
    const userStats = await Bets.aggregate([
      {
        $match: { userId: parseInt(userId) } // Match bets for the specific user
      },
      {
        $group: {
          _id: "$marketId",
          betIds: { $addToSet: "$_id" },
          totalDifference: { $sum: { $subtract: ["$winningAmount", "$loosingAmount"] } },
          totalExposure: { $sum: { $cond: { if: "$calculateExp", then: "$exposureAmount", else: 0 } } },
          winningAmounts: { $addToSet: { $cond: { if: "$calculateExp", then: "$winningAmount", else: 0 } } },
          loosingAmounts: { $addToSet: { $cond: { if: "$calculateExp", then: "$loosingAmount", else: 0 } } },
          totalPosition: { $sum: { $cond: { if: "$calculateExp", then: "$position", else: 0 } } },
          events: { $addToSet: "$event" },
          runnerNames: { $addToSet: "$runnerName" },
        },
      },
      {
        $project: {
          marketId: "$_id",
          betIds: "$betIds",
          totalDifference: "$totalDifference",
          totalExposure: "$totalExposure",
          winningAmounts: "$winningAmounts",
          loosingAmounts: "$loosingAmounts",
          totalPosition: "$totalPosition",
          events: "$events",
          runnerNames: "$runnerNames",
        }
      }
    ]);

    res.status(200).json({ success: true, data: userStats });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getCricketScore(req, res) {
  try {
    // const eventId = 32981327
    const response = await axios.get('http://167.99.198.2/api/matches/score/32981327')
    let resultArray = response;
    res.status(200).json({ success: true, data: resultArray })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get " })
  }
}

async function testAPI(req, res) {
  const marketId = req.params.marketId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "marketIds": [marketId]
      // "maxResults": 100,
      // "maxResults": 100,
      // "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
    }
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getMarketsByEventId(req, res) {
  const eventId = req.params.eventId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-App": process.env.XAPP_NAME,
        "Cache-Control": "no-cache"
      },
    };
    const requestData = {
      filter: {
        eventIds: [eventId],
      },
      maxResults: 200,
      marketProjection: [
        "EVENT",
        "EVENT_TYPE",
        "MARKET_START_TIME",
        "MARKET_DESCRIPTION",
        "RUNNER_DESCRIPTION",
      ],
    };
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const response = await axios.post(url, requestData, header);

    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + err.message });
  }
}

async function getEventsBySportsId(req, res) {
  const sportsId = req.params.sportsId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "filter": {
        eventTypeIds: [sportsId]
      },
    }
    var url = `${sportsAPIUrl}/listEvents`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getOddsByMarketId(req, res) {
  const marketId = req.params.marketId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "marketIds": [marketId]
    }
    var url = `${sportsAPIUrl}/listMarketBook`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}
async function getOddsByMarketId2(req, res) {
  const marketId = req.params.marketId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "marketIds": [marketId]
    }
    var url = `${sportsAPIUrl}/listMarketBook`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getMarketType(req, res) {
  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "filter": {
        eventIds: []
      }
    }
    var url = `${sportsAPIUrl}/listMarketTypes`;

    const response = await axios.post(
      url,
      requestData,
      header
    );
    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getOddsByMultiMarketId(req, res) {
  const eventId = req.params.eventId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "filter": {
        eventIds: [eventId]
      },
      "maxResults": 10,
      "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
    }
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const marketResponse = await axios.post(
      url,
      requestData,
      header
    );

    let marketIds = [];
    for (let i = 0; i < marketResponse?.data?.result?.length; i++) {
      marketIds.push(marketResponse?.data?.result[i].marketId + "")
    }

    const oddsRequestData = {
      "marketIds": marketIds
    }
    var oddsUrl = `${sportsAPIUrl}/listMarketBook`;

    const oddsResponse = await axios.post(
      oddsUrl,
      oddsRequestData,
      header
    );

    const marketsData = oddsResponse?.data?.result;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getTodayEventsBySportsId(req, res) {
  try {
    let sportsId = req.params.sportsId
    var now = new Date();  // Get the current date and time
    var startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    var startOfDayTimestamp = startOfDay.getTime();

    var endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    var endOfDayTimestamp = endOfDay.getTime();

    const events = await inPlayEvents.find(
      {
        sportsId: sportsId,
        status: "OPEN",
        openDate: { $gte: startOfDayTimestamp, $lt: endOfDayTimestamp }
      },
      {
        _id: 1,
        Id: 1,
        name: 1,
        openDate: { $toDate: "$openDate" }
      }
    );

    let data = [];

    for (let k = 0; k < events?.length; k++) {
      data.push({
        _id: events[k]._id,
        Id: events[k].Id,
        name: events[k].name,
        openDate: new Date(events[k].openDate)
      })
    }
    res.status(200).json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getMarketsByMarketType(req, res) {
  const eventId = req.params.eventId;
  const marketTypes = req.params.marketTypes?.split(",");

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    let requestData

    if (marketTypes?.length > 0) {
      requestData = {
        "filter": {
          eventIds: [eventId],
          marketTypes: marketTypes
        },
        "maxResults": 100,
        "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
      }
    } else {
      requestData = {
        "filter": {
          eventIds: [eventId],
        },
        "maxResults": 10,
        "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
      }
    }

    //console.log("---------------------->", requestData)
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const marketResponse = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = marketResponse?.data?.result;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getFanciesByEventId(req, res) {
  const eventId = req.params.eventId;
  const gtype = req.query.gtype;
  console.log("gtype===================================", gtype);
  console.log("eventId===================================", eventId);
  try {
    let sessions = await fetchSession(eventId)
    if (gtype) {
      sessions = sessions.filter(item => item.gtype === gtype)
    }

    res.status(200).json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function fetchEvents(req, res) {
  const sportsId = req.params.sportsId;
  try {
    await apiSystemRacing.fetchRacingEvent(sportsId)
    res.status(200).json({ success: true, message: `Fetched successfully with sportsId: ${sportsId}` });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to get Error: ${err}` })
  }
}

async function getEventList(req, res) {
  const { sportsId, from, to } = req.body;
  try {
    const now = new Date()
    const fromTimestamp = new Date(now.getTime() - (Number(from) * 24 * 60 * 60 * 1000))
    const someHoursLater = new Date(now.getTime() + (Number(to) * 24 * 60 * 60 * 1000))
    const toTimeStamp = someHoursLater.getTime()

    const events = await InPlayEvents.find({
      sportsId: `${sportsId}`,
      openDate: { $gte: fromTimestamp, $lte: toTimeStamp },
    })

    res.status(200).json({ success: true, results: events });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to get Error: ${err}` })
  }
}
async function closeOpenMarkets(req, res) {


  try {


    res.status(200).json({ success: true, data: 'Testing.....' })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get " })
  }

}

async function getMarketsLimitlessByEventId(req, res) {
  const eventId = req.params.eventId;
  // const url = `http://142.93.36.1/api/v2/getMarkets?EventTypeID=4&EventID=${eventId}`;
  const url = `http://84.8.153.51/api/v2/getMarkets?EventTypeID=4&EventID=${eventId}`;
  try {
    const response = await axios.get(url);
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + error.message });
  }
}

async function getMarketsLimitlessByEventId2(req, res) {
  const eventId = req.params.eventId;
  const url = `http://84.8.153.51/api/v2/getSessions?EventTypeID=4&matchId=${eventId}`;
  try {
    const response = await axios.get(url);
    const data = []
    for (const item of response.data) {
      data.push(JSON.parse(item))
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + error.message });
  }
}

async function getBookmakersLimitlessByEventId(req, res) {
  const eventId = req.params.eventId;
  const url = `http://84.8.153.51/api/v2/getBookmakers?EventTypeID=4&EventID=${eventId}`;
  try {
    const response = await axios.get(url);
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + error.message });
  }
}

async function getOddsLimitlessByMarketId(req, res) {
  const marketId = req.params.marketId;
  const url = `http://84.8.153.51/api/v2/getMarketsOdds?EventTypeID=4&marketId=${marketId}`;
  try {
    const response = await axios.get(url);
    res.status(200).json({ success: true, data: JSON.parse(response.data) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + error.message });
  }
}
async function getScoreLimitlessByEventId(req, res) {
  const eventId = req.params.eventId;

  const url = `http://84.8.153.51/api/v2/score?EventTypeID=1&matchId=${eventId}`;
  try {
    const response = await axios.get(url);
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, msg: "Failed and Error: " + error.message });
  }
}

async function createMissingSessions(req, res) {
  totalSession = 20;


  for (let i = 8; i < totalSession; i++) {
    const session = new Session({
      sessionNo: i,
      eventId: 33347567,
      Id: '666c4091a8b2218c182e8379',
      createdAt: 1718399592994,
      updatedAt: 1718399592994,
      manuelSave: false
    });
    session.save();
  }


}


async function TestTrial(req, res) {

  const eventId = req.params.eventId;

  try {


    let FindInMe = "Yes here you can Player in 1 find my string";
    let FindInMeRes = FindInMe.toLowerCase();
    let findMe1 = FindInMeRes.search("player in");
    let findMe2 = FindInMeRes.search("players in");



    if (findMe1 > 0 || findMe2 > 0) {

      await InPlayEvents.updateMany(
        { Id: eventId },
        { $set: { player_in: 1 } }
      )
      res.status(200).json({ success: true, message: 'Event updated successfully.' });
    } else {
      await InPlayEvents.updateMany(
        { Id: eventId },
        { $set: { player_in: 0 } }
      )
      res.status(200).json({ success: true, message: 'Event update failed.' });
    }


  } catch (error) {
    console.error('Error updating odds:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }

}

async function deleteOdds(req, res) {
  const eventId = req.params.eventId;

  try {
    //await Odds.deleteMany({  });
    //await RaceOdds.deleteMany({  });
    await InPlayEvents.updateMany({ Id: eventId }, { $set: { hasFancy: true } });

    const response = await MarketIDS.aggregate([{ $project: { name: "$marketName" } }]);

    const totalMarkets = await MarketIDS.countDocuments({ sportID: 4 });

    var arra = [];
    for (let index = 0; index < response.length; index++) {
      var element = response[index];
      console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++" + element);
      //arra[index] = element.name;
    }
    if (Array.isArray(element)) {
      console.log("Element is an array", element.map(data => console.log(data)));
    } else if (element !== null && typeof element === 'object') {
      console.log("Element is an object");
    } else {
      console.log("Element is neither an array nor an object");
    }

    const totalgreyhound = await MarketIDS.countDocuments({ winnerInfo: null, sportID: 4339 });
    console.log(`totalgreyhound================${totalgreyhound}`);
    const totalhorses = await MarketIDS.countDocuments({ winnerInfo: null, sportID: 7 });
    console.log(`totalhorses================${totalhorses}`);

    res.status(200).json({
      success: true,
      message: `Odds deleted successfully. Last processed element: ${element} --- totalMarkets:: ${totalMarkets}`,
    });
  } catch (error) {
    console.error('Error updating odds:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function getRelatedMarkets(req, res) {
  const { marketId, sportid } = req.params;
  const sportId = +sportid
  // console.log(typeof sportId);
  // const currentDate=  Date.now()
  try {
    const market = await MarketIDS.findOne({ marketId: marketId })
    const marketOpendate = market.openDate;

    const marketData = await MarketIDS.aggregate([
      {
        $match: { sportID: sportId, openDate: { $gt: marketOpendate } }
      },
      {
        $lookup: {
          from: 'raceodds',
          localField: 'marketId',
          foreignField: 'marketId',
          as: 'oddsData'
        }
      },
      {
        $lookup: {
          from: 'inplayevents',
          localField: 'eventId',
          foreignField: 'Id',
          as: 'event'
        }
      },
      {
        $project: {
          _id: 1,
          sportID: 1,
          eventId: 1,
          marketId: 1,
          Name: "$marketName",
          countryCode: { $first: '$event.countryCode' },
          openDate: 1,
          status: 1,
          totalMatched: { $arrayElemAt: ['$oddsData.totalMatched', 0] }
        }
      },
      { $sort: { openDate: 1 } },
      { $limit: 5 },


    ]);
    console.log(".....................................", marketData);
    res.status(200).json({ success: true, message: 'Related Markets:', marketData });
  } catch (error) {
    console.error('Error updating odds:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
async function saveOdds(oddData, sportsId) {
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
  const odd = {
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
  return odd;
  const odds = new Odds(oddData);
  await odds.save();
}

async function getOdds(marketIds, sportsId) {
  return new Promise((resolve, reject) => {
    const odds = [];
    const oddUrl = `http://84.8.153.51/api/v2/getMarketsOdds?EventTypeID=${sportsId}&marketId=${marketIds}`;
    axios
      .get(oddUrl)
      .then(async (oddRes) => {
        if (!oddRes || !oddRes?.data) return;
        if (oddRes.data.length) {
          console.log("===================================================================================1");
          for (const item of oddRes.data) {
            const oddData = JSON.parse(item);
            odds.push(await saveOdds(oddData, sportsId));
          }
        } else {
          const oddData = JSON.parse(oddRes.data);
          console.log("===================================================================================2");
          odds.push(await saveOdds(oddData, sportsId));
        }
        resolve(odds);
      })
      .catch((error) => {
        console.log("error", error.response.data);
        resolve([]);
      });
  });
}

async function cronOdds(req, res) {
  console.log("===================================================================================3");
  const { eventId, sportID } = req.params;
  
 
  const url = `http://84.8.153.51/api/v2/getMarkets?EventTypeID=4&EventID=${eventId}`;


  try {
    const response = await axios.get(url);
    
    
    const marketsData = response.data;
      let marketStatus = 'OPEN';


      if (marketsData && marketsData?.length > 0) {
        let marketIds = [];
        let arrMarketIds = [];
        let cntrl = 0;
        marketsData.forEach((element) => {

         
          

          let tempRunners = [];
          let hasbetfairFancy = false;
          
          for (let k = 0; k < element?.runners?.length; k++) {
            tempRunners.push({
              SelectionId: element?.runners[k]?.selectionId,
              runnerName: element?.runners[k]?.runnerName
            });
          }




          
       
            if (element.marketName === 'Match Odds') {

              console.log("nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn>>.",element);

              marketIds.push({
                id: element.marketId,
                marketName: element.marketName,
                sort: 1,
                openDate: Date.parse(element.marketStartTime),
                status: marketStatus,
                hasbetfairFancy: hasbetfairFancy,
                runners: tempRunners
              });
            }
            
            const marketID =  MarketIDS.findOne({
              eventId: eventId,
              marketId: element.marketId
            });

            if(!marketID){

              const newMarket = new MarketIDS({
                eventId: eventId,
                marketId: element.marketId,
                marketName: element.marketName,
                sportID: '4',
                totalMatched: element.totalMatched,
                status: marketStatus,
                index: 0,
                runners: tempRunners,
                inPlay: true
              });
              console.log("nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn>>.",newMarket);
              const newmarket =  newMarket.save();


            }

        });
      

        
      }



  } catch (error) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + error.message });
  }





  const sendMarketIds = [];
  







  let result = [];
  console.log("sending market ids..............................................>",sendMarketIds);
  for (const marketIds of sendMarketIds) {
    console.log("===================================================================================5");
    const odds = await getOdds(marketIds, sportID);
    result = [...result, ...odds];
  }
  res.json({ status: true, data: "here in res"+result });

}

async function cronOdds2(req, res) {
  const { eventId, sportID } = req.params;
  const markets = await MarketIDS.find({
    // openDate: { $gte: Date.now() + 2 * 60 * 1000 },
    // status: "CLOSED",
    eventId,
    sportID,
  });
  const count = 15;
  const pages = Math.ceil(markets.length / count);
  const matchIds = markets.map((e) => e.marketId);
  const sendMarketIds = [];
  for (let i = 0; i < pages; i++) {
    let matchId = [];
    if (i === 0) {
      matchId = matchIds.slice(0, i + 1 * count);
    } else {
      matchId = matchIds.slice(i * count, (i + 1) * count);
    }
    sendMarketIds.push(matchId.join(","));
  }
  let result = [];
  for (const marketIds of sendMarketIds) {
    const odds = await getOdds(marketIds, sportID);
    result = [...result, ...odds];
  }
  res.json({ status: true, data: "here in res" });

}
async function getTheSportsMatchScoreEvents(req, res) {


  const { sportsId } = req.params;
  const inplays = await inPlayEvents.find({ sportsId });
  let sportsName = 'cricket';
  if (sportsId === '1') {
    sportsName = 'football';
  } else if (sportsId === '2') {
    sportsName = 'tennis';
  }
  const theSportsUrl = `https://api.thesports.com/v1/${sportsName}/match/diary?user=stepinn&secret=f365f74fbc01e6ecf55ba89bb725f504`;
  axios
    .get(theSportsUrl)
    .then(async ({ data }) => {
      const results = [];
      if (data?.results && data?.results?.length) {
        const newDatas = data.results.map((item) => {
          const home_team = data.results_extra.team.find((e) => e.id === item.home_team_id);
          item.home_team = home_team.name;
          const away_team = data.results_extra.team.find((e) => e.id === item.away_team_id);
          item.away_team = away_team.name;
          item.match_time = item.match_time * 1000;
          if (home_team.name && away_team.name) return item;
        });
        for (const newData of newDatas) {
          const data = inplays.filter((e) => (
            e.name.toLowerCase().includes(newData.home_team.toLowerCase()) ||
            e.name.toLowerCase().includes(newData.away_team.toLowerCase()) ||
            newData.home_team.toLowerCase().includes(e.name.split(' v ')[0]) ||
            newData.away_team.toLowerCase().includes(e.name.split(' v ')[1])
          ) && e.openDate === newData.match_time);
          if (data.length) {
            if (data.length === 1) {
              results.push({ ...data[0]._doc, theSports: newData });
            }
          }
        }
        //for (const item of results) {
        //await inPlayEvents.updateOne({ _id: item._id }, { theSportsId: item.theSports.id });
        //}
      }
      res.json({ status: true, data: { count: results.length, results } });
    })
    .catch((error) => {
      console.log('error', error?.response?.data);
      res.status(500).json({ status: false, data: error?.response?.data });
    });



}




async function getMatchEvents(req, res) {
  const { sportsId } = req.params;
  const inplays = await inPlayEvents.find({ sportsId });
  let sportsName = 'cricket';
  if (sportsId === '1') {
    sportsName = 'football';
  } else if (sportsId === '2') {
    sportsName = 'tennis';
  }
  const theSportsUrl = `https://api.thesports.com/v1/${sportsName}/match/diary?user=stepinn&secret=f365f74fbc01e6ecf55ba89bb725f504`;
  axios
    .get(theSportsUrl)
    .then(async ({ data }) => {
      const results = [];
      if (data?.results && data?.results?.length) {
        const newDatas = data.results.map((item) => {
          const home_team = data.results_extra.team.find((e) => e.id === item.home_team_id);
          item.home_team = home_team.name;
          const away_team = data.results_extra.team.find((e) => e.id === item.away_team_id);
          item.away_team = away_team.name;
          item.match_time = item.match_time * 1000;
          if (home_team.name && away_team.name) return item;
        });
        for (const newData of newDatas) {
          const data = inplays.filter((e) => (
            e.name.toLowerCase().includes(newData.home_team.toLowerCase()) ||
            e.name.toLowerCase().includes(newData.away_team.toLowerCase()) ||
            newData.home_team.toLowerCase().includes(e.name.split(' v ')[0]) ||
            newData.away_team.toLowerCase().includes(e.name.split(' v ')[1])
          ) && e.openDate === newData.match_time);
          if (data.length) {
            if (data.length === 1) {
              results.push({ ...data[0]._doc, theSports: newData });
            }
          }
        }
        //for (const item of results) {
        //await inPlayEvents.updateOne({ _id: item._id }, { theSportsId: item.theSports.id });
        //}
      }
      res.json({ status: true, data: { count: results.length, results } });
    })
    .catch((error) => {
      console.log('error', error?.response?.data);
      res.status(500).json({ status: false, data: error?.response?.data });
    });
}


////////////////
async function updateUserBetSizesColec(req, res) {

  // const role = req.decoded.login.role
  // if (role != 0) {
  //   return res.send({
  //     message: 'you are not allowed to update bet sizes',
  //     success: true,

  //   });
  // }

  try {
    // await BetLimits.insertMany([{
    //   name: 'Over by Over',
    //   sportsId: '4',
    //   subarket: 70,
    //   maxAmount: 200000,
    //   ExpAmount: 200000,
    //   minAmount: 1000
    // },
    // {
    //   name: 'Betfair Fancy',
    //   sportsId: '4',
    //   subarket: 100,
    //   maxAmount: 200000,
    //   ExpAmount: 200000,
    //   minAmount: 1000
    // }])

    const userIds = await User.aggregate([
      {
        $group: {
          _id: "$userId",
        },
      },
      { $sort: { _id: 1 } },
    ])
    // console.log(userIds, "IIIIIIIIIIIIIIII");

    const userids = userIds.filter((data) => data._id !== null).sort().map((data) => data._id)
    // console.log(userids);

    let betLimits = await BetLimits.find({
      $or: [
        { name: "Betfair Fancy" },
        { name: "Over by Over" }
      ]
    });

    for (let i = 0; i <= userIds.length; i++) {

      let userId = userids[i]
      // let userId = 11001

      const userbetSizesData = betLimits.map((betLimit) => ({
        userId: userId,
        betLimitId: betLimit._id,
        amount: betLimit.maxAmount,
        name: betLimit.name,
        sportsId: betLimit.sportsId,
        subarket: betLimit.subarket,
        minAmount: betLimit.minAmount,
        ExpAmount: betLimit.ExpAmount
      }));

      // console.log(userbetSizesData);    
      //     await userBetSizes.deleteMany({ userId:userId });
      await userBetSizes.deleteMany({
        userId: userId,
        name: { $in: ["Betfair Fancy", "Over by Over"] }
      });

      await userBetSizes.insertMany(userbetSizesData);

    }

    return res.send({
      message: 'User Best Sizrs Updated Successfully',
      success: true,
      // results: userbetSizesData
    });

  } catch (error) {
    console.error("Error in updateUserBetSizesColec:", error);
    return res.status(500).send({
      message: 'An error occurred while updating user bet sizes',
      success: false,
      error: error.message,
    });

  }

}
///////////////
async function getRaceLatestRecord(req,res){
   const {collectionName,marketId} =req.params;

   console.log(`raceodds ------- ${collectionName}---------`);
   console.log(`marketId ------- ${marketId}---------`);
   
  //  const marketId = req.query.marketId
  // raceodds

   try {
    if (collectionName =="odds"){
      const raceLatestRecord =await Odds.aggregate([
        {
          $match:{marketId:marketId}
      },
      {$sort:{createdAt:-1}},
          {$limit:1}
    ])
        res.status(200).json({ success: true, message: 'Sports Latest Record from odds:', raceLatestRecord });
     }
      else{
        const raceLatestRecord= await RaceOdds.aggregate([
          {
            $match:{marketId:marketId}
          },
          {$sort:{createdAt:-1}},
          {$limit:1}
        ])

        res.status(200).json({ success: true, message: 'Race Latest Record race odds:', raceLatestRecord });
      }
      
   } catch (error) {
    console.error("Error in updateUserBetSizesColec:", error);
    res.status(500).json({ success: false, message: 'Internal server error' });
   }

}


async function updateUserName(req, res) {
  console.log("updating user name");
  try {
    const user = await Users.updateMany(
      {},
      [{ $set: { userName: { $toLower: "$userName" } } }]
    );

    res.status(200).json({
      success: true,
      message: 'User names updated successfully',
      user
    });
  } catch (error) {
    console.error("Error in update user name:", error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
async function testing(req, res) {
  try {
    const currentTime = Date.now();
// const formattedTime = currentTime.toLocaleTimeString();
console.log(currentTime,"//////");
    

    res.status(200).json({
      success: true,
      message: 'User names updated successfully',
   
    });
  } catch (error) {
    console.error("Error in update user name:", error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}



// //////////////////
router.get('/track-bet/updateUserName', updateUserName)
router.get('/track-bet/testing', testing)
/////////////////
//////
router.get('/updateUserBetSizesColec', updateUserBetSizesColec);/////// temprory route
/////
router.get('/track-bet/get-latest-odds/:marketId/:collectionName', getRaceLatestRecord)
router.get('/testSports/events', listEvents)
router.get('/temp-work/closeopenmarkets', closeOpenMarkets)
router.get('/track-score/get-cricketscore', getCricketScore)
router.get('/testSports/events', listEvents);
router.get('/testSports/marketbooks/:ids', listMarketBook);
router.get('/trackstuck/activeusers', activeUserExposure);
router.get('/trackstuck/inactiveusers', inActiveUserExposure);
router.get('/track-bet/bet-statistic/:userId', betStatisticsByUserId)

router.get('/track-bet/testAPI/:marketId', testAPI)
router.get('/track-bet/get-markets/:eventId', getMarketsByEventId)
router.get('/track-bet/get-events/:sportsId', getEventsBySportsId)
router.get('/track-bet/get-today-events/:sportsId', getTodayEventsBySportsId)
router.get('/track-bet/get-odds/:marketId', getOddsByMarketId)
router.get('/track-bet/get-odds2/:marketId', getOddsByMarketId2)
router.get('/track-bet/get-odds-multi-marketids/:eventId', getOddsByMultiMarketId)
router.get('/track-bet/get-markettype', getMarketType)
router.get('/track-bet/get-market-by-type/:eventId/:marketTypes?', getMarketsByMarketType)
router.get('/track-bet/get-market-bet-session/:eventId', getFanciesByEventId)

router.get('/track-bet/get-markets-limitless/:eventId', getMarketsLimitlessByEventId)
router.get('/track-bet/get-markets-limitless2/:eventId', getMarketsLimitlessByEventId2)
router.get('/track-bet/get-bookmakers-limitless/:eventId', getBookmakersLimitlessByEventId)
router.get('/track-bet/get-odds-limitless/:marketId', getOddsLimitlessByMarketId)
router.get('/track-bet/get-score-limitless/:eventId', getScoreLimitlessByEventId)
router.get('/track-bet/check-market/:sportID/:eventId', cronOdds)
router.get('/track-bet/check-market2/:sportID/:eventId', cronOdds2)
router.get('/track-bet/delete-odds/:eventId', deleteOdds)
router.get('/track-bet/get-relatedmarkets/:marketId/:sportid', getRelatedMarkets)
router.get('/track-bet/test-trial/:eventId', TestTrial)
router.get('/match-events/:sportsId', getMatchEvents)
router.get('/match-events-details/:sportsId', getTheSportsMatchScoreEvents)
/*admin dashboard*/
router.get('/admin-dashboard/fetch-events/:sportsId', fetchEvents)

router.post('/list-events', getEventList)

module.exports = { router, listEvents, listMarketBook, activeUserExposure, inActiveUserExposure, getCricketScore };

