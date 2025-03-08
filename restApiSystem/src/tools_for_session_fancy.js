'use strict';

const axios = require('axios');

const inPlayEvents = require('../../app/models/events');
const FancyEvent = require('../../app/models/fancyEvent');
const FancyOdds = require('../../app/models/fancyOdds');
const MarketIDs = require('../../app/models/marketIds');
const { isIterable, isObjectEqual } = require("../../helper/common");
const { fetchSession } = require("../../helper/api/sessionAPIHelper");
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

  function buildFancyStructure(bookmakerMarketList, bookmakerOdds, fancyOdds, eventId) {
    let t3 = []
    let bm = {}
    for (const odd of fancyOdds) {
      if (odd.gtype === 'session' || odd.gtype === 'oddeven') {
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
    if (bookmakerOdds !== 0) {
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

        let fancyOdds = 0;
        fancyOdds = await fetchSession(eventId);


        let bookmakerMarketList = await fetchBookmakerList(eventId)
        let bookmakerMarketIds = []
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", eventId, '......', bookmakerMarketList.length);
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", eventId, '......', fancyOdds.length);
        if (bookmakerMarketList.length > 0) {
          for (const [index, market] of bookmakerMarketList.entries()) {
            if(market?.marketName != 'Bookmaker') await matchOverFancyAndScoreFancy(eventId, market.marketId);
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
                },
                {
                  eventId: eventId,
                  marketId: market.marketId,
                  marketName: market.marketName,
                  sportID: 4,
                  // status: '',
                  runners: runners,
                  inPlay: true
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );


            }
          }
          //start of bookmakers call for odds here...
          let bookmakerOdds = 0;
          if (bookmakerMarketIds.length > 0) {
            bookmakerOdds = await fetchBookmakerOdds(bookmakerMarketIds[0])

            if (bookmakerOdds.length > 0 && fancyOdds.length > 0) {

              const fancyData = buildFancyStructure(bookmakerMarketList, bookmakerOdds, fancyOdds, eventId)
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
            } else if (bookmakerOdds.length > 0 && fancyOdds.length == 0) {
              const fancyData = buildFancyStructure(bookmakerMarketList, bookmakerOdds, 0, eventId)
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
            } else if (bookmakerOdds.length == 0 && fancyOdds.length > 0) {
              const fancyData = buildFancyStructure(bookmakerMarketList, 0, fancyOdds, eventId)
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
            }
          } else if (fancyOdds.length > 0) {


            const fancyData = buildFancyStructure(bookmakerMarketList, 0, fancyOdds, eventId)
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


          }
          //end of bookmakers call for odds here...

          //start fancyOdds call...


          //end fancyOdds call

        }

        // console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>",eventId,'======',fancyOdds);

      }
    } catch (error) {
      console.error("Error getting session fancy odds:", error);
    } finally {
      setTimeout(getSessionFancyOdds, 1000)
    }
  }

  async function matchOverFancyAndScoreFancy(eventId, marketId) {
    try {
      const apiUrl = `https://ofa77.xyz/cricketresultauto3.php?id=${eventId}`;
      const response = await axios.get(apiUrl);
      const { scoreFancy, overFancy } = response.data;
      const fancyList = [...scoreFancy, ...overFancy];
  
      let now = new Date();
      const numericDateTime = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
  
      for (let fancy of fancyList) {
        const { name, result } = fancy;
  
        // Check if a matching fancyName and eventId exists in DB
        const existingRecord = await MarketIDS.findOne({ fancyName: name, eventId });
  
        if (existingRecord) {
          // Update the score if a match is found
          await MarketIDS.updateOne(
            { fancyName: name, eventId },
            {
              $set: { fancyResultScore: result, winnerRunnerData: result },
              $setOnInsert: {
                eventId: eventId,
                marketId: marketId,
                __v: 0,
                inPlay: false,
                index: 0,
                lastCheck: 0,
                lastResultCheckTime: 0,
                openDate: 0,
                readyForScore: true,
                sportID: 4,
                status: 'Fancy Result',
                updatedAt: numericDateTime,
                totalMatched: '0'
              }
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true
            }
          );
          console.log(`Updated score for ${name} (Event ID: ${eventId})`);
        } else {
          console.log(`No matching record found for ${name} (Event ID: ${eventId})`);
        }
      }
    } catch (error) {
      console.error("Error updating scores:", error);
    } finally {
      await client.close();
    }
  }
}

module.exports = ToolForSessionFancy;
