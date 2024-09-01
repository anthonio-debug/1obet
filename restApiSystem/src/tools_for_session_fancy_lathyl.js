'use strict';

const axios = require('axios');

const inPlayEvents = require('../../app/models/events');
const FancyEvent = require('../../app/models/fancyEvent');
const FancyOdds = require('../../app/models/fancyOdds');
const MarketIDs = require('../../app/models/marketIds');
const MarketIDS = require("../../app/models/marketIds");
const { isIterable, isObjectEqual } = require("../../helper/common");
const { fetchSession } = require("../../helper/api/sessionAPIHelperLithyl");
const { fetchBookmakerList, fetchBookmakerOdds } = require("../../helper/api/sessionAPIHelper");
require('dotenv').config()

let io;

const FancyOddsMap = new Map()

function ToolForSessionFancy() {
  return { init };

  async function init(_io, express) {
    io = _io;

    getSessionFancyOdds()
  }

  function buildFancyStructure2( bookmakerOdds, fancyOdds,oddevenOdds, eventId) {
    let t3 = []
    let bm = {}
    // console.log("bookmakerOdds.................................::",bookmakerOdds);
    // console.log("fancyOdds.................................::",fancyOdds);
    // console.log("oddevenOdds.................................::",oddevenOdds);
    for (const odd of fancyOdds) {
      console.log("odd.gtype.......................:::",odd.gtype);
      if (odd.gtype === 'Fancy' || odd.gtype === 'oddeven') {
        t3.push({
          b1: odd.BackPrice1,
          b2: odd.BackPrice2,
          b3: odd.BackPrice3,
          bs1: odd.BackSize1,
          bs2: odd.BackSize2,
          bs3: odd.BackSize3,
          l1: odd.LayPrice1,
          l2: odd.LayPrice2,
          l3: odd.LayPrice3,
          ls1: odd.LaySize1,
          ls2: odd.LaySize2,
          ls3: odd.LaySize3,
          nat: odd.RunnerName,
          gstatus: odd.GameStatus,
          gtype: odd.gtype,
          sid: odd.SelectionId,
          ssid: `${eventId}_${odd.SelectionId}`,
        })
      }
    }
if(bookmakerOdds!==0){
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
            s: runner.status,
            sid: runner.selectionId,
            ssid: odd?.marketId,
            nat: runner.runnerName,
          })
        }
      }
      bm[`bm${index + 1}`] = bms
    }
  }
    return {
      data: {
        t1: null,
        t2: [{ ...bm }],
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
      const now = new Date()
      const from = new Date(now.getTime() + (432000 * 60 * 1000)).getTime()
      let fancyEvents = await inPlayEvents.find({
        sportsId: '4', isShowed: true,
        hasFancy: true,
        CompanySetStatus: "OPEN",
        openDate: { $lte: from },
        status: 'OPEN'
      }, { Id: 1 }).exec();

      for (const event of fancyEvents) {
        const eventId = event.Id
        
        let ReqOdds = [];
        
         ReqOdds = await fetchSession(eventId)
         console.log("ReqOdds...........................................",ReqOdds);
        let bookmakerOdds = 0;
        let fancyOdds = 0;
        let oddevenOdds = 0;
        let bookmakerMarketList = [];
        let bookmakerMarketIds = []
        if(ReqOdds['oddevenArr'] && ReqOdds['oddevenArr'].length>0){
          oddevenOdds = ReqOdds['fanciesArr'];
        }
        if(ReqOdds['fanciesArr'] && ReqOdds['fanciesArr'].length>0){
          fancyOdds = ReqOdds['fanciesArr'];

        }
        if(ReqOdds['bookMakerArr'] && ReqOdds['bookMakerArr'].length>0){
          bookmakerOdds = ReqOdds['bookMakerArr'];
          bookmakerMarketList = ReqOdds['bookMakerArr'];
          let runners = []
          let Bmarketid;
          for (const [index, market] of bookmakerMarketList.entries()) {
            
              bookmakerMarketIds.push(market?.mid)
              
              Bmarketid = market.mid;
                runners.push({
                  SelectionId: market.sid,
                  runnerName: market.nat,
                })
              
              }
              
              await MarketIDS.findOneAndUpdate(
                {
                  eventId: eventId,
                  marketId: Bmarketid,
                }, {
                eventId: eventId,
                marketId: Bmarketid,
                marketName: 'Bookmaker',
                sportID: 4,
                // status: '',
                runners: runners,
                inPlay: true
              },
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );
            
          


        }
          


         
         const fancyData = buildFancyStructure2( bookmakerOdds, fancyOdds,oddevenOdds, eventId)
           // console.log('fancy oddsssssssssssssss returned',fancyData);
            if (!FancyOddsMap.has(eventId) || !isObjectEqual(FancyOddsMap.get(eventId), fancyData)) {
              FancyOddsMap.set(eventId, fancyData)
              let newFancyOdds = new FancyOdds({
                eventId: eventId,
                marketId: eventId,
                data: fancyData,
              })
              
              await newFancyOdds.save();
              
              io.to('#' + eventId).emit('fancy_odds', newFancyOdds);
            }




         
         
         

        // console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>",eventId,'======',fancyOdds);
        
      }
    } catch (error) {
      console.error("Error getting session fancy odds:", error);
    } finally {
      setTimeout(getSessionFancyOdds, 1000)
    }
  }
}

module.exports = ToolForSessionFancy;
