'use strict';
module.exports = ToolForResults;
const sportsIdsForRacing = ['4339', '7'];
const sportsIds = ['4', '2', '1'];
const Bets = require('../../app/models/bets');
const { checkActiveBettors } = require('../../helper/bet');
const scoreChecker = require('./api/scoreChecker')();
const { getAmountOfWinnerTemp, getAmountOfWinnerTempUpdated } = require('./CalculateBets/helper');

const { handleWinningBetXX } = require('../../resultSystem/src/CalculateBets/calculations');
const MarketIDS = require('../../app/models/marketIds');

function ToolForResults() {
  return { init };

  async function init() {
    console.log("***********************************");
    console.log("**** resultChecker initialized ****");
    console.log("***********************************");

    getBetForEvents(sportsIds);
    setTimeout(() => {
      getBetForEvents(sportsIdsForRacing);
    }, 2000);
    getBetForFancy();
    //getBetForAsianOdd();
    manuelBetChecker();
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
    const currentTime = new Date().getTime();
    try {

      const betData = await Bets.find({
        sportsId: '4',
        subMarktId: { $in: ['7', '8'] },
        calculateExp: true,
        // userId:45558,
        status: 1,
      })
        .sort({
          lastCheckResult: 1
        })
        .exec();


      const checkActive = await checkActiveBettors(betData);

      if (betData && !checkActive) {
        await Bets.updateOne(
          {
            _id: betData._id
          },
          {
            $set: { lastCheckResult: currentTime }
          }
        ).catch((e) => console.error(e));
        // console.log("------------------------------------------------------------------------",betData);

        // console.log("betData going to fancyResult----",betData);
        // await scoreChecker.fancyResult(betData);


        const fanciesMarketIds = await MarketIds.find({
          winnerRunnerData: { $ne: null },
          isSettled: false,
          marketId: /over/
        });

        for (const fancyMarketId of fanciesMarketIds) {
          const betData = await Bets.find({
            sportsId: '4',
            subMarktId: { $in: ['7', '8'] },
            calculateExp: true,
            marketId: fancyMarketId.marketId,
            status: 1,
          })
            .sort({
              lastCheckResult: 1
            })
            .exec();

          let newRecord = new resultRecords({
            eventId: betData.matchId,
            marketData: fancyMarketId.marketId,
            resultData: fancyMarketId.winnerRunnerData.result
          });

          newRecord.save();

          for (const bet of betData) {
            await Bets.updateMany(
              {
                matchId: betData.matchId.toString(),
                isfancyOrbookmaker: true,
                fancyData: fancyMarketId.marketId
              },
              {
                $set: {
                  resultId: newRecord._id,
                  resultData: fancyMarketId.winnerRunnerData.result
                }
              }
            );

            await getAmountOfWinnerTemp(bet, fancyMarketId.winnerRunnerData.result, 0);
          }

          await MarketIDS.updateOne(
            {
              _id: fancyMarketId._id
            },
            {
              $set: {
                isSettled: true
              }
            }
          )
        }

      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setTimeout(() => {
        getBetForFancy();
      }, 2 * 1000);
    }
  }



  async function manuelBetChecker() {
    try {
      const results = await Bets.aggregate([
        {
          $match: {
            status: 1,
            calculateExp: true,
            iscancelled: false,
            type: { $in: [2, 3, 4] },
            betSession: { $ne: null }
          }
        },
        {
          $lookup: {
            from: 'sessions',
            let: { matchId: '$matchId', betSession: '$betSession' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$Id', '$$matchId'] },
                      { $eq: ['$sessionNo', '$$betSession'] }
                    ]
                  }
                }
              }
            ],
            as: 'sessionDetails'
          }
        },
        {
          $unwind: '$sessionDetails'
        },
        {
          $match: {
            'sessionDetails.score': { $ne: 0 },
            'sessionDetails.manuelSave': true
          }
        },
        {
          $project: {
            betData: '$$ROOT',
            score: '$sessionDetails.score'
          }
        },
        {
          $sort: {
            'betData.eventId': 1,  // Sort by betData.subMarketId in ascending order (use -1 for descending)
          }
        }
      ]).exec();


      if (results.length > 0) {
        //console.log("results------befor mnauel----",results);
        await scoreChecker.manuel(results);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setTimeout(() => {
        manuelBetChecker();
      }, 5 * 1000);
    }
  }


}
