'use strict';
module.exports = ToolForEvent;

// const sportsIds = ["1", "7522", "2", "4", "27454571", "468328"];
const sportsIds = ["1", "2", "4"];

const inPlayEvents = require('../../app/models/events');
const MarketIDs = require('../../app/models/marketIds');
const Odds = require('../../app/models/odds');
const config = require("../../config/default.json")

const apiRequests = require('./api/apiRequestsTestSCT.js')();

let lastType = 0;

function ToolForEvent() {
  return {init};

  async function init(_io, express) {
    apiRequests.init(_io, express);

    if (config.activeProvider === 'NEW') {
      fetchEvents();

      setInterval(fetchEvents, 6 * 60 * 60 * 1000);
      setInterval(fetchMarkets, 10 * 1000);
      // setInterval(handleSetInplay, 10 * 1000);

      setInterval(() => {
        for (const sportsId of sportsIds) {
          apiRequests.setInplay(sportsId);
        }
      }, 10 * 1000);

      setInterval(async () => {
        for (const sportsId of sportsIds) {
          await apiRequests.checkInPlay(sportsId);
        }
      }, 30 * 1000);

      setInterval(() => {
        fetchOdds(true);
      }, 1500);
    }
  }

  async function fetchEvents() {
    try {
      for (const sportsId of sportsIds) {
        await apiRequests.eventsBySupportJobs(sportsId);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }

  async function fetchMarkets() {
    try {
      for (const id of sportsIds) {
        const documents = await inPlayEvents.findOne({
          status: 'OPEN',
          CompanySetStatus: "OPEN",
          isShowed: true,
          sportsId: id
        })
          .sort({lastCheckMarket: 1})
          .limit(1)
          .exec();
        if (documents && documents.Id) {
          const existedMarkets = await MarketIDs.findOne({eventId: documents.Id})

          if (documents && !existedMarkets?._id) {
            await apiRequests.listMarketsByCronJob(documents.Id, documents.sportsId, documents.competitionId);
            await inPlayEvents.updateMany(
              {Id: documents.Id},
              {$set: {lastCheckMarket: Date.now()}}
            );
            fetchOddsForEvent(documents.Id);
          }
        }

      }
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
  }

  async function fetchOddsForEvent(eventId) {
    try {
      const documents = await MarketIDs.find({inPlay: true, eventId: eventId})
        .sort({lastCheck: 1})
        .limit(20)
        .exec();
      let marketIds = [];

      if (documents.length > 0) {
        documents.forEach(element => {
          marketIds.push(element.marketId);
        });
      }

      await MarketIDs.updateMany(
        {marketId: {$in: marketIds}},
        {$set: {lastCheck: Date.now()}}
      );

      if (marketIds.length > 0) {
        apiRequests.getOddsFromProvider(documents, eventId);
      }
    } catch (error) {
      console.error('Error fetching odds for event:', error);
    }
  }

  async function fetchOdds(inPlay) {
    try {
      const documents = await MarketIDs.aggregate([
        {
          $match: {
            inPlay: inPlay,
            $or: [
              {sportID: 1},
              {sportID: 2},
              {sportID: 4},
            ],
          },
        },
        {
          $lookup: {
            from: "inplayevents",
            localField: "eventId",
            foreignField: "Id",
            as: "event",
          },
        },
        {
          $addFields: {
            event: {
              $cond: {
                if: {
                  $eq: [{$type: "$event"}, "array"]
                },
                then: {$arrayElemAt: ["$event", 0]},
                else: "$event"
              }
            }
          }
        },
        {
          $match: {
            "event.CompanySetStatus": "OPEN",
            "event.status": "OPEN",
          }
        },
        {
          $sort: {lastCheck: 1},
        },
        {
          $limit: 30,
        }
      ]).exec();

      let marketIds = [];

      if (documents.length > 0) {
        documents.forEach(element => {
          marketIds.push(element.marketId);
        });
      }

      await MarketIDs.updateMany(
        {marketId: {$in: marketIds}},
        {$set: {lastCheck: Date.now()}}
      );

      if (marketIds.length > 0) {
        apiRequests.getOddsFromProvider(documents);
      }
    } catch (error) {
      console.error('Error fetching odds:', error);
    }
  }

  async function handleSetInplay() {
    const documents = await inPlayEvents.find({isShowed: true, inplay: false})
      .limit(20)
      .exec();

    if (documents.length > 0) {
      for (const document of documents) {
        await inPlayEvents.updateOne(
          {Id: document.Id}, {$set: {inplay: true}}
        )
      }
    }
  }
}
