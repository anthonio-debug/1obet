'use strict';
module.exports = ToolForResults;
const sportsIdsForRacing = ['4339', '7'];
const sportsIds = ['4', '2', '1'];
const Bets = require('../../app/models/bets');
const inPlayEvents = require('../../app/models/events');
const { checkActiveBettors } = require('../../helper/bet');
const scoreChecker = require('./api/scoreChecker')();
const { getAmountOfWinnerTemp, getAmountOfWinnerTempUpdated } = require('./CalculateBets/helper');
const resultRecords = require('../../app/models/resultRecords');
const Settings = require("../../app/models/settings");
const { handleWinningBetXX } = require('../../resultSystem/src/CalculateBets/calculations');
const MarketIDS = require('../../app/models/marketIds');
const mongoose = require('mongoose');
let config = require('config');

function ToolForResults() {
  return { init };

  async function init() {
    console.log("***********************************");
    console.log("**** resultChecker initialized ****");
    console.log("***********************************");

    // getBetForEvents(sportsIds); // settle sports
    // setTimeout(() => {
    //   getBetForEvents(sportsIdsForRacing);
    // }, 2000);
    getBetForFancy(); // settle fancies
    //getBetForAsianOdd();
    //manuelBetChecker();
    //manuelCancelledBetChecker();
  }

  async function getBetForEvents(targetArray) {
    //console.log("-----------------------------------------------------------");
    const currentTime = new Date().getTime();
    try {
      const results = await Bets.aggregate([
        {
          $match: {
            sportsId: { $in: targetArray },
            marketId: { $ne: null },
            isfancyOrbookmaker: false,
            status: 1,
            calculateExp: true,
            type: { $in: [0, 1] }
          }
        },
        {
          $group: {
            _id: '$marketId',
            betDocument: { $first: '$$ROOT' }
          }
        },
        {
          $sort: {
            lastCheckResult: 1
          }
        },
        {
          $limit: 5
        }
      ]).exec();

      console.log("step 1");
      console.log(results);

      for (const result of results) {
        const checkActive = await checkActiveBettors(result.betDocument);
        if (checkActive) continue;
        //console.log("result.documentIds-------------------------------",result.documentIds);
        await Bets.updateMany(
          {
            _id: { $in: result.documentIds }
          },
          {
            $set: { lastCheckResult: currentTime }
          }
        ).catch((e) => console.error(e));

        if (!result.betDocument) continue;

        if (result.betDocument.sportsId === '1' || result.betDocument.sportsId === '2' || result.betDocument.sportsId === '4') {
          //console.log("result.betDocument----------------------------------------------",result.betDocument);
          console.log("***********************************");
          console.log("********** getBetForevents before eventsresult ***********");
          console.log("***********************************");

          console.log(result.betDocument);

          await scoreChecker.eventsResult(result.betDocument);

        } else if (result.betDocument.sportsId === '7' || result.betDocument.sportsId === '4339') {
          await scoreChecker.racingResult(result.betDocument);
        } else {
          //console.log("Undefined sports type ", result.betDocument);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setTimeout(() => {
        getBetForEvents(targetArray);
      }, 10 * 1000);
    }
  }

  async function getBetForFancy() {
    let isError = false;

    await Settings.findOneAndUpdate({ settingKey: 'IsTempJobRunning' }, { $set: { settingValue: '0' } });
    try {
      const fanciesMarketIds = await MarketIDS.find({ // find all fancy marketids that winnerrunnerdata is not null and not settled
        // _id: mongoose.Types.ObjectId('67bf0756d57296e20cc4d718')
        winnerRunnerData: { $ne: null },
        isSettled: false
      });

      console.log("fanciesMarketIds:",fanciesMarketIds);

      let resultData
      let Settings1
      let cancelled = 0
      for (const fancyMarketId of fanciesMarketIds) {

        Settings1 = await Settings.findOne({ settingKey: 'IsTempJobRunning', settingValue: '1' })
        console.log("Settings1------",Settings1);
        if (Settings1) {
          return
        }
        await Settings.findOneAndUpdate({ settingKey: 'IsTempJobRunning' }, { $set: { settingValue: '1' } });

        const event = await inPlayEvents.findOne({ Id: fancyMarketId.eventId }, { Id: 1 });
        console.log("event:",event);
        const betData = await Bets.find({ // find the latest bets
          calculateExp: true,
          marketId: fancyMarketId.marketId,
          status: 1,
        })
          .sort({
            lastCheckResult: 1
          })
          .exec();

        const checkActive = await checkActiveBettors(betData);

        if (fancyMarketId.marketName == 'Bookmaker') {
          resultData = fancyMarketId.winnerRunnerData.result
        } else {
          resultData = fancyMarketId.winnerRunnerData;
        }

        if(fancyMarketId.winnerRunnerData== '-1' || fancyMarketId.winnerInfo){
          cancelled = 1
        }


        console.log(fancyMarketId);
        console.log(resultData);
        console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$');

        console.log(event);
        let newRecord = new resultRecords({
          eventId: event._id,
          marketData: fancyMarketId.marketId,
          resultData: resultData
        });

        newRecord.save();

        if (betData/*  && !checkActive */) { // update last checktime


          await Bets.updateMany( // update all the bets
            {
              eventId: fancyMarketId.eventId,
              marketId: fancyMarketId.marketId,
              status: 1,
            },
            {
              $set: {
                resultId: newRecord._id,
                resultData: resultData
              }
            }
          );

          console.log("bets updated successfully");

          for (const bet of betData) {
            console.log("calling getAmountOfWinnerTemp => ");
            console.log(bet._id);
            if(config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))){
            resultData = fancyMarketId.winnerRunnerData % (bet.type === 3 ? 2 : 10);

            if (bet.type === 4 && resultData < 6 && resultData > 0) {
                resultData = 0;
            }
          }

            let settleRes = await getAmountOfWinnerTemp(bet, resultData, cancelled); // settle

            if(!settleRes) {
              console.log("**************")
              console.log("error occured")

              throw new Error("Error occured while settling the bet");
            }
          }
        }


        await MarketIDS.updateOne( // update the marketid state as settled
          {
            _id: fancyMarketId._id
          },
          {
            $set: {
              isSettled: true
            }
          }
        )
        await Settings.findOneAndUpdate({ settingKey: 'IsTempJobRunning' }, { $set: { settingValue: '0' } });
      }


    } catch (error) {
      await Settings.findOneAndUpdate({ settingKey: 'IsTempJobRunning' }, { $set: { settingValue: '0' } });
      console.error('Error:', error);
    } finally {
      setTimeout(() => {
        getBetForFancy();
      }, 2 * 1000);
    }
  }



  // async function manuelBetChecker() {
  //   try {
  //     const results = await Bets.aggregate([
  //       {
  //         $match: {
  //           status: 1,
  //           calculateExp: true,
  //           iscancelled: false,
  //           type: { $in: [2, 3, 4] },
  //           betSession: { $ne: null }
  //         }
  //       },
  //       {
  //         $lookup: {
  //           from: 'sessions',
  //           let: { matchId: '$matchId', betSession: '$betSession' },
  //           pipeline: [
  //             {
  //               $match: {
  //                 $expr: {
  //                   $and: [
  //                     { $eq: ['$Id', '$$matchId'] },
  //                     { $eq: ['$sessionNo', '$$betSession'] }
  //                   ]
  //                 }
  //               }
  //             }
  //           ],
  //           as: 'sessionDetails'
  //         }
  //       },
  //       {
  //         $unwind: '$sessionDetails'
  //       },
  //       {
  //         $match: {
  //           'sessionDetails.score': { $ne: 0 },
  //           'sessionDetails.manuelSave': true
  //         }
  //       },
  //       {
  //         $project: {
  //           betData: '$$ROOT',
  //           score: '$sessionDetails.score'
  //         }
  //       },
  //       {
  //         $sort: {
  //           'betData.eventId': 1,  // Sort by betData.subMarketId in ascending order (use -1 for descending)
  //         }
  //       }
  //     ]).exec();


  //     if (results.length > 0) {
  //       //console.log("results------befor mnauel----",results);
  //       await scoreChecker.manuel(results);
  //     }
  //   } catch (error) {
  //     console.error('Error fetching data:', error);
  //   } finally {
  //     setTimeout(() => {
  //       manuelBetChecker();
  //     }, 5 * 1000);
  //   }
  // }


}
