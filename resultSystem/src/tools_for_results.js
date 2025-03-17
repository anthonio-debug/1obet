'use strict';
module.exports = ToolForResults;
const sportsIdsForRacing = ['4339', '7'];
const sportsIds = ['4', '2', '1'];
const Bets = require('../../app/models/bets');
const inPlayEvents = require('../../app/models/events');
const { checkActiveBettors } = require('../../helper/bet');
const scoreChecker = require('./api/scoreChecker')();
const { getAmountOfWinnerTemp } = require('./CalculateBets/helper');
const resultRecords = require('../../app/models/resultRecords');
const Settings = require("../../app/models/settings");
const { handleWinningBetXX } = require('../../resultSystem/src/CalculateBets/calculations');
const MarketIDS = require('../../app/models/marketIds');
const cloneMarketIDS = require('../../app/models/clonemarketIds');
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
        status: { $in: ['Fancy Result', 'Session Result', 'CLOSED'] },
        isSettled: false,
        lastCheck: { $gt: 0 }
      }).sort({ lastCheck: -1 }).limit(10);

      console.log("fanciesMarketIds:", fanciesMarketIds);

      let resultData
      let Settings1
      let cancelled = 0
      for (const fancyMarketId of fanciesMarketIds) {

        Settings1 = await Settings.findOne({ settingKey: 'IsTempJobRunning', settingValue: '1' })
        console.log("Settings1------", Settings1);
        if (Settings1) {
          return
        }
        await Settings.findOneAndUpdate({ settingKey: 'IsTempJobRunning' }, { $set: { settingValue: '1' } });

        const event = await inPlayEvents.findOne({ Id: fancyMarketId.eventId }, { Id: 1 });
        console.log("event:", event);

        if (!event) {
          await Settings.findOneAndUpdate({ settingKey: 'IsTempJobRunning' }, { $set: { settingValue: '0' } });
          continue;
        }

        let fancyData = fancyMarketId.marketId;

        // if (fancyData.indexOf('(') >= 0) fancyData = fancyData.slice(0, fancyData.indexOf('('));

        let cleanedInput = fancyData.replace(/[^A-Za-z0-9]/g, '').toUpperCase();  // Clean and uppercase the input
        let cleanedInput_ballrun = cleanedInput;
        if (cleanedInput_ballrun.search(/over/i) >= 0) {
          cleanedInput_ballrun = fancyData.replace(/over/gi, 'ball').replace(/[^A-Za-z0-9]/g, '').toUpperCase();  // Clean and uppercase the input
        } else {
          cleanedInput_ballrun = fancyData.replace(/ball/gi, 'over').replace(/[^A-Za-z0-9]/g, '').toUpperCase();  // Clean and uppercase the input
        }
        let query = { // find the latest bets
          calculateExp: true,
          status: 1,
        }

        console.log(fancyData);
        console.log(cleanedInput, cleanedInput_ballrun);

        if (fancyMarketId.betSession) {
          query = { ...query, betSession: fancyMarketId.betSession }
        }
        // Aggregate query to clean the marketId field in the database and match with the cleaned input
        const betData = await Bets.aggregate([
          {
            $match: query
          },
          {
            $addFields: {
              cleanedMarketId: {
                $toUpper: {
                  $replaceAll: {
                    input: { $ifNull: [{ $toString: "$marketId" }, ""] },  // Ensure marketId is treated as a string
                    find: " ",  // Replace spaces with empty string
                    replacement: ""
                  }
                }
              }
            }
          },
          {
            $addFields: {
              cleanedMarketId: {
                $replaceAll: {
                  input: { $ifNull: [{ $toString: "$cleanedMarketId" }, ""] },  // Ensure cleanedMarketId is treated as a string
                  find: "-",  // Replace dashes with empty string
                  replacement: ""
                }
              }
            }
          },
          {
            $addFields: {
              cleanedMarketId: {
                $replaceAll: {
                  input: { $ifNull: [{ $toString: "$cleanedMarketId" }, ""] },  // Ensure cleanedMarketId is treated as a string
                  find: ".",  // Replace dashes with empty string
                  replacement: ""
                }
              }
            }
          },
          {
            $addFields: {
              cleanedMarketId: {
                $replaceAll: {
                  input: { $ifNull: [{ $toString: "$cleanedMarketId" }, ""] },  // Ensure cleanedMarketId is treated as a string
                  find: "(",  // Replace dashes with empty string
                  replacement: ""
                }
              }
            }
          },
          {
            $addFields: {
              cleanedMarketId: {
                $replaceAll: {
                  input: { $ifNull: [{ $toString: "$cleanedMarketId" }, ""] },  // Ensure cleanedMarketId is treated as a string
                  find: ")",  // Replace dashes with empty string
                  replacement: ""
                }
              }
            }
          },
          {
            $match: {
              cleanedMarketId: { $in: cleanedInput == cleanedInput_ballrun ? [cleanedInput] : [cleanedInput, cleanedInput_ballrun] }

            }
          }
        ]).sort({
          lastCheckResult: 1
        });



        console.log(query);


        console.log("**********************&&&&&&&!!!!!!!!!!!!!!!!!!");
        console.log("**********************&&&&&&&!!!!!!!!!!!!!!!!!!");
        console.log("**********************&&&&&&&!!!!!!!!!!!!!!!!!!");
        console.log(betData);



        const checkActive = await checkActiveBettors(betData);

        if (fancyMarketId.marketName == 'Bookmaker') {


          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log("Bookmaker marketId:", fancyMarketId.marketId);
          console.log(fancyMarketId.winnerRunnerData);

          // resultData = fancyMarketId.winnerRunnerData.result
          resultData = fancyMarketId.winnerRunnerData
        } else {
          resultData = fancyMarketId.winnerRunnerData;
        }

        if (fancyMarketId.winnerRunnerData == '-1' || fancyMarketId.winnerInfo == '-1') {
          cancelled = 1
        }


        console.log(fancyMarketId);
        console.log(resultData);
        console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$');

        console.log(event);
        let newRecord = new resultRecords({
          eventId: event?._id,
          marketData: fancyMarketId.marketId,
          betSession: fancyMarketId?.betSession,
          resultData: resultData
        });

        newRecord.save();

        if (betData) { // update last checktime

          console.log("fancyMarketId;", fancyMarketId);
          if (fancyMarketId.betSession && fancyMarketId.betSession != 0) {
            console.log("betsession");

            await Bets.updateMany(
              {
                _id: {
                  $in: [...betData.map(item => item._id)]
                }
              },
              {
                $set: {
                  resultId: newRecord._id,
                  resultData: resultData
                }
              }
            )
            // await Bets.updateMany( // update all the bets
            //   {
            //     eventId: fancyMarketId.eventId,
            //     marketId: fancyMarketId.marketId,
            //     betSession: fancyMarketId.betSession,
            //     status: 1,
            //   },
            //   {
            //     $set: {
            //       resultId: newRecord._id,
            //       resultData: resultData
            //     }
            //   }
            // );
          } else {
            console.log("not betsession");

            await Bets.updateMany( // update all the bets
              {
                eventId: fancyMarketId.eventId,
                marketId: fancyMarketId.marketId,
                //  betSession: fancyMarketId.betSession,
                status: 1,
              },
              {
                $set: {
                  resultId: newRecord._id,
                  resultData: resultData
                }
              }
            );
          }


          console.log("bets updated successfully");

          console.log("betData is array: => ", Array.isArray(betData));
          console.log(betData);

          if (Array.isArray(betData) == true)
            for (const bet of betData) {
              console.log("calling getAmountOfWinnerTemp => ");
              console.log(bet._id);
              if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
                console.log("insie market-fancyMarketId.winnerRunnerData.........", fancyMarketId.winnerRunnerData);
                resultData = fancyMarketId.winnerRunnerData % (bet.type === 3 ? 2 : 10);
                console.log("resultData sessions.........", resultData);
                if (bet.type === 4 && resultData < 6 && resultData > 0) {
                  resultData = 0;
                }
              }

              let settleRes = await getAmountOfWinnerTemp(bet, resultData, cancelled); // settle

              if (!settleRes) {
                console.log("**************")
                console.log("error occured")

                throw new Error("Error occured while settling the bet");
                return;
              }
            }


          // await MarketIDS.deleteOne({ _id: fancyMarketId._id });
          // console.log();
          await MarketIDS.updateOne( // update the marketid state as settled
            {
              _id: fancyMarketId._id
            },
            {
              $set: {
                isSettled: true,
                lastCheck: new Date().getTime()
              }
            }
          );

          let cloneitem = await MarketIDS.findById(fancyMarketId._id);
          cloneitem = cloneitem.toObject();

          delete cloneitem._id; // Remove the _id from cloneitem to prevent duplicates
          delete fancyMarketId._id; // Remove the _id from fancyMarketId for the same reason
          
          // clone marketid
          let cloneresult = await cloneMarketIDS.collection.insertOne({ ...cloneitem });
          let cloneresult1 = await cloneMarketIDS.collection.insertOne({
            ...fancyMarketId, isSettled: true,
            lastCheck: new Date().getTime()
          });
          console.log("cloneresult");
          console.log(cloneresult, cloneresult1);


        }



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
