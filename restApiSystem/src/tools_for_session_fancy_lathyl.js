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
    
     console.log("fancyOdds length................",oddevenOdds,".................>>",fancyOdds.length);
     console.log("oddevenOdds length...............",oddevenOdds,"..................>>",oddevenOdds.length);
     console.log("bookmakerOdds length.................................>>",bookmakerOdds);

     
    if(oddevenOdds.length>0){
     for (const odd of oddevenOdds) {
      //console.log("odd.gtype.......................:::",odd.gtype);
      
        let gtype = 'oddeven';
        
        t3.push({
          b1: odd.b1,
          b2: 0,
          b3: 0,
          bs1: odd.bs1,
          bs2: 0,
          bs3: 0,
          l1: odd.l1,
          l2: 0,
          l3: 0,
          ls1: odd.ls1,
          ls2: 0,
          ls3: 0,
          nat: odd.nat,
          gstatus: odd.gstatus,
          gtype: gtype,
          sid: odd.sid,
          ssid: `${eventId}_${odd.sid}`,
        })
      
    }
  }

  if(fancyOdds.length>0){
    for (const odd of fancyOdds) {
     //console.log("odd.gtype.......................:::",odd.gtype);
     
       let gtype = 'session';
       
       t3.push({
         b1: odd.b1,
         b2: 0,
         b3: 0,
         bs1: odd.bs1,
         bs2: 0,
         bs3: 0,
         l1: odd.l1,
         l2: 0,
         l3: 0,
         ls1: odd.ls1,
         ls2: 0,
         ls3: 0,
         nat: odd.nat,
         gstatus: odd.gstatus,
         gtype: gtype,
         sid: odd.sid,
         ssid: `${eventId}_${odd.sid}`,
       })
     
   }
 }



if(bookmakerOdds!==0){
  let bms = []
    for (const [index, odd] of bookmakerOdds.entries()) {
      
     
          bms.push({
            b1: odd.b1,
            b2: 0,
            b3: 0,
            bs1: odd.bs1,
            bs2: 0,
            bs3: 0,
            l1: odd.l1,
            l2: 0,
            l3: 0,
            ls1: odd.ls1,
            ls2: 0,
            ls3: 0,
            s: odd.s,
            sid: odd.sid,
            ssid: odd?.mid,
            nat: odd.nat,
          })
        
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
        console.log("IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII:::",eventId);
         ReqOdds = await fetchSession(eventId)
        // console.log("ReqOdds...........................................",ReqOdds);
        let bookmakerOdds = 0;
        let fancyOdds = [];
        let oddevenOdds = [];
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
            console.log('fancy oddsssssssssssssss returned',fancyData);
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
