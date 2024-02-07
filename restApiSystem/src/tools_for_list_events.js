'use strict';
module.exports = ToolForEvent;

// const sportsIds = ["1", "7522", "2", "4", "27454571", "468328"];
const sportsIds = ["1", "2", "4"];

const inPlayEvents = require('../../app/models/events');
const MarketIDs = require('../../app/models/marketIds');
const config = require("../../config/default.json")

const apiRequests = require('./api/apiRequestsTestSCT.js')();
const {CRICKET_LIVE_SET_MIN} = require('../../helper/constants')
const moment = require("moment/moment");

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
        let event = null
        if (id === "4") {
          event = await inPlayEvents.findOne({
            status: 'OPEN',
            CompanySetStatus: "OPEN",
            isShowed: true,
            sportsId: id
          })
            .sort({lastCheckMarket: 1})
            .limit(1)
            .exec();
        } else {
          const now = new Date()
          const from = new Date(now.getTime() - (30 * 60 * 1000))
          const someHoursLater = new Date(now.getTime() + 10 * 60 * 60 * 1000)
          const to = someHoursLater.getTime()
          event = await inPlayEvents.findOne({
            status: 'OPEN',
            CompanySetStatus: "OPEN",
            isShowed: true,
            openDate: {$gte: from, $lte: to},
            sportsId: id
          })
            .sort({lastCheckMarket: 1})
            .limit(1)
            .exec();
        }

        if (event && event.Id) {
          await inPlayEvents.updateOne(
            {Id: event.Id},
            {$set: {lastCheckMarket: Date.now()}}
          );
          const openDate = Number(event.openDate)
          const now = moment().utc().valueOf()
          if ((event.sportsId === '4') && (openDate - now) < (CRICKET_LIVE_SET_MIN * 60 * 1000)) {
            await inPlayEvents.updateOne(
              {Id: event.Id},
              {$set: {inplay: true}}
            );
          }
          const existedMarkets = await MarketIDs.findOne({eventId: event.Id, status: "OPEN", inPlay: true})

          if (event && !existedMarkets?._id) {
            await apiRequests.listMarketsByCronJob(event.Id, event.sportsId, event.competitionId);
            await fetchOddsForEvent(event.Id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
  }

  async function fetchOddsForEvent(eventId) {
    try {
      const marketIds = await MarketIDs.find({inPlay: true, eventId: eventId})
        .sort({lastCheck: 1})
        .limit(20)
        .exec();
      let marketIdList = [];

      if (marketIds.length > 0) {
        marketIds.forEach(element => {
          marketIdList.push(element.marketId);
        });
      }

      await MarketIDs.updateMany(
        {marketId: {$in: marketIdList}},
        {$set: {lastCheck: Date.now()}}
      );

      if (marketIdList.length > 0) {
        await apiRequests.getOddsFromProvider(marketIds, eventId);
      }
    } catch (error) {
      console.error('Error fetching odds for event:', error);
    }
  }

  async function fetchOdds(inPlay) {
    try {
      const marketIds = await MarketIDs.aggregate([
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

      let marketIdList = [];

      if (marketIds.length > 0) {
        marketIds.forEach(element => {
          marketIdList.push(element.marketId);
        });
      }

      await MarketIDs.updateMany(
        {marketId: {$in: marketIdList}},
        {$set: {lastCheck: Date.now()}}
      );

      if (marketIdList.length > 0) {
        await apiRequests.getOddsFromProvider(marketIdList);
      }
    } catch (error) {
      console.error('Error fetching odds:', error);
    }
  }
}
