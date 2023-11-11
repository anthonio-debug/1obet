"use strict";
module.exports = ToolForResults;

const sportsIdsforRacing = ["4339", "7"];
const sportsIds = ["4", "2", "1"];
const Bets = require("../../app/models/bets");
const Sessions = require("../../app/models/Session");
const scoreChecker = require("./api/scoreChecker")();

function ToolForResults() {
  return { init };

  async function init() {
    getBetForEvents(sportsIds);
    getBetForEvents(sportsIdsforRacing);
    getBetForFancy();
    getBetForAsianOdd();
    manuelBetChecker();
  }

  async function getBetForEvents(targetArray) {
    const currentTime = new Date().getTime();
    try {
      const results = await Bets.aggregate([
        {
          $match: {
            sportsId: { $in: targetArray },
            //resultId: null,
            marketId: { $ne: null },
            isfancyOrbookmaker: false,
            status: 1,
            type: { $in: [0, 1] },
          },
        },
        {
          $group: {
            _id: "$marketId",
            betDocument: { $first: "$$ROOT" },
          },
        },
        {
          $sort: {
            lastCheckResult: 1,
          },
        },
        {
          $limit: 5,
        },
      ]).exec();

      //console.log(targetArray);

      for (const result of results) {
        await Bets.updateMany(
          {
            _id: { $in: result.documentIds },
          },
          {
            $set: { lastCheckResult: currentTime },
          }
        ).catch((e) => console.error(e));
      }

      for (const result of results) {
        if (result.betDocument.length == 0) continue;

        if (
          result.betDocument.sportsId == 1 ||
          result.betDocument.sportsId == 2 ||
          result.betDocument.sportsId == 4
        ) {
          await scoreChecker.eventsResult(result.betDocument);
        } else if (
          result.betDocument.sportsId == 7 ||
          result.betDocument.sportsId == 4339
        ) {
          await scoreChecker.racingResult(result.betDocument);
        } else {
          console.log("Undefined sports type ", result.betDocument);
        }
      }
    } catch (error) {
      console.error("Error:", error);
    }

    setTimeout(() => {
      getBetForEvents(targetArray);
    }, 4 * 1000);
  }

  async function getBetForFancy() {
    const currentTime = new Date().getTime();
    try {
      const results = await Bets.findOne({
        sportsId: "4",
        //resultId: null,
        isfancyOrbookmaker: true,
        status: 1,
      })
        .sort({
          lastCheckResult: 1,
        })
        .limit(1)
        .exec();

      if (results) {
        await Bets.updateOne(
          {
            _id: results._id,
          },
          {
            $set: { lastCheckResult: currentTime },
          }
        ).catch((e) => console.error(e));

        if (results.fancyData) {
          await scoreChecker.fancyResult(results, results.fancyData);
        } else {
          await scoreChecker.bookMakerResult(results);
        }
      }

      setTimeout(() => {
        getBetForFancy();
      }, 5 * 1000);
    } catch (error) {
      setTimeout(() => {
        getBetForFancy();
      }, 5 * 1000);
      console.error("Error:", error);
    }
  }

  async function getBetForAsianOdd() {
    const currentTime = new Date().getTime();
    try {
      const results = await Bets.find({
        marketId: "8",
        status: 1,
      }).exec();

      for (const result of results) {
        await Bets.updateMany(
          {
            _id: { $in: result.documentIds },
          },
          {
            $set: { lastCheckResult: currentTime },
          }
        ).catch((e) => console.error(e));
      }
      if (results.length > 0) {
        await scoreChecker.asianResult(results);
      }
    } catch (error) {
      console.error("Error:", error);
    }
    setTimeout(() => {
      getBetForAsianOdd();
    }, 5 * 1000);
  }

  async function manuelBetChecker() {
    try {
      const results = await Bets.aggregate([
        {
          $match: {
            status: 1,
            type: { $in: [2, 3, 4] },
            betSession: { $ne: null },
          },
        },
        {
          $lookup: {
            from: "sessions",
            let: { matchId: "$matchId", betSession: "$betSession" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$Id", "$$matchId"] },
                      { $eq: ["$sessionNo", "$$betSession"] },
                    ],
                  },
                },
              },
            ],
            as: "sessionDetails",
          },
        },
        {
          $unwind: "$sessionDetails",
        },
        {
          $match: {
            "sessionDetails.score": { $ne: 0 },
            "sessionDetails.manuelSave": true,
          },
        },
        {
          $project: {
            betData: "$$ROOT", // Retain all the original data from the Bets table
            score: "$sessionDetails.score",
          },
        },
      ]);

      await scoreChecker.manuel(results);

      setTimeout(() => {
        manuelBetChecker();
      }, 5 * 1000);
    } catch (error) {
      console.error("Error fetching data:", error);
      setTimeout(() => {
        manuelBetChecker();
      }, 5 * 1000);
    }
  }
}
