'use strict';

const axios = require('axios');

const inPlayEvents = require('../../app/models/events');
const FancyEvent = require('../../app/models/fancyEvent');
const FancyOdds = require('../../app/models/fancyOdds');
const MarketIDs = require('../../app/models/marketIds');
const {HYBRID_URI} = require("../../app/global/constants");
const MarketIDS = require("../../app/models/marketIds");
const {isIterable} = require("../../helper/common");
const {
  getFancyMarketList,
  getBookmakerMarketList,
  getFancyOdds,
  getBookmakerOdds
} = require("../../helper/hybridApiHelper");
const {fetchSession} = require("../../helper/sessionAPIHelper");
const {fetchBookmakerList, fetchBookmakerOdds} = require("../../helper/bookmakerApiHelper");
require('dotenv').config()

const HYBRID_PROVIDER = process.env.HYBRID_PROVIDER || 'pys'

let io;

function ToolForSessionFancy() {
  return {init};

  async function init(_io, express) {
    io = _io;

    getSessionFancyOdds()
  }

  function buildFancyStructure(bookmakerMarketList, bookmakerOdds, fancyOdds, eventId) {
    let t3 = []
    let bm = {}
    for (const odd of fancyOdds) {
      if (odd.inplay) {
        const market = fancyMarketList.find(market => market?.market?.id === odd.marketId)
        t3.push({
          b1: odd.back[0].price,
          b2: odd.back[1].price,
          b3: odd.back[2].price,
          bs1: odd.back[0].size,
          bs2: odd.back[1].size,
          bs3: odd.back[2].size,
          l1: odd.lay[0].price,
          l2: odd.lay[1].price,
          l3: odd.lay[2].price,
          ls1: odd.lay[0].size,
          ls2: odd.lay[1].size,
          ls3: odd.lay[2].size,
          nat: market?.market?.name,
          gstatus: odd.status,
          sid: odd.marketId,
        })
      }

    }

    for (const [index, odd] of bookmakerOdds.entries()) {
      let bms = []
      if (isIterable(odd.runners)) {
        for (const runner of odd.runners) {
          bms.push({
            b1: runner.back[0].price,
            b2: runner.back[1].price,
            b3: runner.back[2].price,
            bs1: runner.back[0].size,
            bs2: runner.back[1].size,
            bs3: runner.back[2].size,
            l1: runner.lay[0].price,
            l2: runner.lay[0].price,
            l3: runner.lay[0].price,
            ls1: runner.lay[0].size,
            ls2: runner.lay[0].size,
            ls3: runner.lay[0].size,
            s: runner.runnerStatus,
            sid: runner.selectionId,
            ssid: odd?.marketId,
            nat: runner.name,
          })
        }
      }
      bm[`bm${index + 1}`] = bms
    }
    return {
      data: {
        t1: null,
        t2: [{...bm}],
        t3,
        t4: null,
      },
      "eventTypeId": "4",
      "eventTypeName": "cricket",
      "gameId": eventId
    }
  }

  async function getSessionFancyOdds() {
    try {
      let fancyEvents = await inPlayEvents.find({
        sportsId: '4', isShowed: true,
        hasFancy: true,
        CompanySetStatus: "OPEN",
        status: 'OPEN'
      }, {Id: 1}).exec();
      for (const event of fancyEvents) {
        const eventId = event.Id
        let fancyOdds = await fetchSession(eventId)
        if (fancyOdds) {
          let bookmakerMarketList = await fetchBookmakerList(eventId)
          let bookmakerMarketIds = []
          for (const [index, market] of bookmakerMarketList.entries()) {
            if (market?.marketName === 'Bookmaker') {
              bookmakerMarketIds.push(market?.marketId)
              let runners = []
              for (const runner of market.runners) {
                runners.push({
                  SelectionId: runner.selectionId,
                  runnerName: runner.runnerName,
                })
              }
              await MarketIDS.findOneAndUpdate(
                {
                  eventId: eventId,
                  marketId: market.marketId,
                }, {
                  eventId: eventId,
                  marketId: market.marketId,
                  marketName: market.marketName,
                  sportID: 4,
                  // status: '',
                  runners: runners,
                  inPlay: true
                },
                {upsert: true, new: true, setDefaultsOnInsert: true}
              );

            }
          }
          if (bookmakerMarketIds.length > 0) {
            let bookmakerOdds = await fetchBookmakerOdds(bookmakerMarketIds[0])
            if (bookmakerOdds.length > 0) {
              const fancyData = buildFancyStructure(bookmakerMarketList, bookmakerOdds, fancyOdds, eventId)
              let newFancyOdds = new FancyOdds({
                eventId: eventId,
                marketId: eventId,
                data: fancyData,
              })
              await newFancyOdds.save();
              io.to('#' + eventId).emit('fancy_odds', newFancyOdds);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error getting hybrid fancy odds:", error);
    } finally {
      setTimeout(getSessionFancyOdds, 1000)
    }
  }
}

module.exports = ToolForSessionFancy;
