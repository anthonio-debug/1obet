const express = require('express');
const currentPosition = require('../models/CurrentPosition');
const Bets = require('../models/bets');
const MarketId = require("./../models/marketIds");
const inPlayEvents = require('../models/events');
const loginRouter = express.Router();

function getCurrentPosition(req, res) {
  try {
    const userId = req.decoded.userId;
    //console.log("userId ======= ", userId);
    currentPosition.aggregate([
      {
        $match: {
          userId: userId
        }
      },
      {
        $addFields: {
          'inPlayEventId': { $toObjectId: "$matchsId" }
        }
      },
      {
        "$lookup": {
          "from": "inplayevents",
          "localField": "inPlayEventId",
          "foreignField": "_id",
          "as": "matches"
        }
      },
      {
        "$unwind": "$matches"
      },
      {
        $group: {
          _id: "$matches._id",
          "name": {
            "$first": "$matches.name"
          },
          "sportsId": {
            "$first": "$matches.sportsId"
          },
          "Id": {
            "$first": "$matches.Id"
          },
          "marketId": {
            "$first": "$matches.marketIds"
          },
          amount: {
            $sum: "$amount"
          }
        }
      }
    ], (err, currentPositionData) => {
      if (err) {
        const response = {
          success: false,
          message: 'Failed to get data',
          error: err,
        };
        res.send(response);
      } else {
        const response = {
          success: true,
          message: 'current position records',
          results: currentPositionData
        };
        res.send(response);
      }
    });
  }
  catch (error) {
    console.error(error);
    return {
      success: false,
      message: 'Failed to get data',
      error: error.message,
    };
  }
}

function getCurrentPosition_old(req, res) {
  try {
    const userId = req.decoded.userId;
    //console.log("userId ======= ", userId);
    currentPosition.aggregate([
      {
        $match: {
          userId: userId
        }
      },
      {
        $addFields: {
          'inPlayEventId': { $toObjectId: "$matchsId" }
        }
      },
      {
        "$lookup": {
          "from": "inplayevents",
          "localField": "inPlayEventId",
          "foreignField": "_id",
          "as": "matches"
        }
      },
      {
        "$unwind": "$matches"
      },
      {
        $group: {
          _id: "$marketId",
          "subMarketId": {
            "$first": "$subMarketId"
          },
          "name": {
            "$first": "$matches.name"
          },
          "sportsId": {
            "$first": "$matches.sportsId"
          },
          "Id": {
            "$first": "$matches.Id"
          },
          "marketId": {
            "$first": "$matches.marketIds"
          },
          "subMarketId": {
            "$first": "$matches.subMarketId"
          },
          amount: {
            $sum: "$amount"
          }
        }
      }
    ], (err, currentPositionData) => {
      if (err) {
        const response = {
          success: false,
          message: 'Failed to get data',
          error: err,
        };
        res.send(response);
      } else {
        const response = {
          success: true,
          message: 'current position records',
          results: currentPositionData
        };
        res.send(response);
      }
    });
  }
  catch (error) {
    console.error(error);
    return {
      success: false,
      message: 'Failed to get data',
      error: error.message,
    };
  }
}

const currentPositionDetails = async (req, res) => {
  try {
    const userId = req.decoded.userId;
    const matchId = req.query.matchId;

    currentPosition.aggregate([
      {
        $match: {
          userId: userId,
          matchsId: matchId
        }
      },
      {
        $addFields: {
          'betsId': { $toObjectId: "$betId" }
        }
      },
      {
        "$lookup": {
          "from": "bets",
          "localField": "betsId",
          "foreignField": "_id",
          "as": "bets"
        }
      },
      {
        $group: {
          _id: "$_id",
          marketId: { $first: { $arrayElemAt: ["$bets.marketId", 0] } },
          matchId: { $first: { $arrayElemAt: ["$bets.matchId", 0] } },
          loosingAmount: { $first: "$amount" },
          loosingAmount1: { $first: { $arrayElemAt: ["$bets.loosingAmount", 0] } },
          winningAmount1: { $first: { $arrayElemAt: ["$bets.winningAmount", 0] } },
          maxWinningAmount: {
            $first: {
              $multiply: [
                { $arrayElemAt: ["$bets.loosingAmount", 0] },
                { $divide: ["$share", 100] }
              ]
            }
          },
          runner: { $first: { $arrayElemAt: ["$bets.runner", 0] } },
          TargetScore: { $first: { $arrayElemAt: ["$bets.TargetScore", 0] } },
          betRate: { $first: { $arrayElemAt: ["$bets.betRate", 0] } },
          betSession: { $first: { $arrayElemAt: ["$bets.betSession", 0] } },
          resultId: { $first: { $arrayElemAt: ["$bets.resultId", 0] } },
          fancyData: { $first: { $arrayElemAt: ["$bets.fancyData", 0] } },
          isfancyOrbookmaker: { $first: { $arrayElemAt: ["$bets.isfancyOrbookmaker", 0] } },
          subMarketId: { $first: { $arrayElemAt: ["$bets.subMarketId", 0] } },
          fancyRate: { $first: { $arrayElemAt: ["$bets.fancyRate", 0] } },
          runnerId: { $first: { $arrayElemAt: ["$bets.runnerName", 0] } },
          type: { $first: { $arrayElemAt: ["$bets.type", 0] } },
          share: { $first: "$share" }
        }
      }
    ], (err, currentPositionData) => {
      if (err) {
        const response = {
          success: false,
          message: 'Failed to get data',
          error: err,
        };
        res.send(response);
      } else {
        const response = {
          success: true,
          message: 'current position records',
          results: currentPositionData
        };
        res.send(response);
      }
    });
  } catch (err) {
    // //console.log("current positiion Error ============= ", err);
    const response = {
      success: true,
      message: `current position error ${err}`,
    }
    res.send(response);
  }
}

const getCurrentPosition2 = async (req, res) => {
  try {
    const userId = req.decoded.userId;
    const matchId = req.query.matchId;

    currentPosition.aggregate([
      {
        $match: {
          userId: userId
        }
      },
      {
        $addFields: {
          'betsId': { $toObjectId: "$betId" }
        }
      },
      {
        "$lookup": {
          "from": "bets",
          "localField": "betsId",
          "foreignField": "_id",
          "as": "bets"
        }
      },
      {
        $addFields: {
          'inPlayEventId': { $toObjectId: "$matchsId" }
        }
      },
      {
        "$lookup": {
          "from": "inplayevents",
          "localField": "inPlayEventId",
          "foreignField": "_id",
          "as": "matches"
        }
      },
      {
        $group: {
          _id: "$_id",
          marketId: { $first: { $arrayElemAt: ["$bets.marketId", 0] } },
          matchId: { $first: { $arrayElemAt: ["$bets.matchId", 0] } },
          loosingAmount: { $first: "$amount" },
          maxWinningAmount: {
            $first: {
              $multiply: [
                { $arrayElemAt: ["$bets.loosingAmount", 0] },
                { $divide: ["$share", 100] }
              ]
            }
          },
          runner: { $first: { $arrayElemAt: ["$bets.runner", 0] } },
          createdAt: { $first: { $arrayElemAt: ["$bets.createdAt", 0] } },
          userId: { $first: { $arrayElemAt: ["$bets.userId", 0] } },
          TargetScore: { $first: { $arrayElemAt: ["$bets.TargetScore", 0] } },
          betRate: { $first: { $arrayElemAt: ["$bets.betRate", 0] } },
          betSession: { $first: { $arrayElemAt: ["$bets.betSession", 0] } },
          resultId: { $first: { $arrayElemAt: ["$bets.resultId", 0] } },
          fancyData: { $first: { $arrayElemAt: ["$bets.fancyData", 0] } },
          isfancyOrbookmaker: { $first: { $arrayElemAt: ["$bets.isfancyOrbookmaker", 0] } },
          subMarketId: { $first: { $arrayElemAt: ["$bets.subMarketId", 0] } },
          fancyRate: { $first: { $arrayElemAt: ["$bets.fancyRate", 0] } },
          runnerId: { $first: { $arrayElemAt: ["$bets.runnerName", 0] } },
          runners: { $first: { $arrayElemAt: ["$bets.runnersPosition", 0] } },
          type: { $first: { $arrayElemAt: ["$bets.type", 0] } },
          sportsId: { $first: { $arrayElemAt: ["$bets.sportsId", 0] } },
          event: { $first: { $arrayElemAt: ["$bets.event", 0] } },
          mId: { $first: { $arrayElemAt: ["$matches.Id", 0] } },
          matchId: { $first: { $arrayElemAt: ["$matches._id", 0] } },
          share: { $first: "$share" }
        }
      },
      {
        $sort: { _id: -1 }
      },
    ], (err, currentPositionData) => {
      if (err) {
        const response = {
          success: false,
          message: 'Failed to get data',
          error: err,
        };
        res.send(response);
      } else {
        const response = {
          success: true,
          message: 'current position records',
          results: currentPositionData
        };
        res.send(response);
      }
    });
  } catch (err) {
    // //console.log("current positiion Error ============= ", err);
    const response = {
      success: true,
      message: `current position error ${err}`,
    }
    res.send(response);
  }
}

const getHighlights = async (req, res) => {
  try {
    const userId = req.decoded.userId;
    const matchId = req.query.matchId;

    await inPlayEvents.aggregate([
      {
        $match: {
          CompanySetStatus: "OPEN",
          isShowed: true,
          status: "OPEN"
        },
      },
      {
        $lookup: {
          from: "MarketId",
          localField: "Id", 
          foreignField: "eventId",
          as: "marketData",
        },
      },
      {
        $unwind: {
          path: "$marketData",
          preserveNullAndEmptyArrays: true 
        }
      },
      {
        $match: {
          "marketData.status": "OPEN", 
          "marketData.marketName": "Match Odds",
        }
      },
      {
        $lookup: {
          from: "odds",
          localField: "Id", 
          foreignField: "eventId",
          as: "oddsData",
        },
      },
      {
        $unwind: {
          path: "$oddsData",
          preserveNullAndEmptyArrays: true 
        }
      },
      {
        $group: {
          _id: "$_id",
          eventName: { $first: "$name" },
          openDate: { $first: "$openDate" },
          CompanySetStatus: { $first: "$CompanySetStatus" },
          isShowed: { $first: "$isShowed" },
          totalMatched: { $first: "$oddsData.totalMatched" },
          inplay: { $first: "$oddsData.isInplay" },
          marketName: { $first: "$marketData.marketName" },
          eventId: { $first: "$marketData.eventId" },
          sportID: { $first: "$marketData.sportID" }
        },
      },
      {
        $addFields: {
          openDate: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S", 
              date: { $toDate: "$openDate" }, 
              timezone: "UTC" 
            }
          }
        }
      },
      {
        $sort: {
          openDate: -1 
        }
      }
    ])
      .exec((err, currentPositionData) => {
        if (err) {
          console.error("Aggregation Error: ", err);
          res.status(500).send({
            success: false,
            message: "Failed to get data",
            error: err.message,
          });
        } else {
          res.send({ success: true, message: "highlights records", results: currentPositionData });
        }
      });

  } catch (err) {
    console.error("Error in getHighlights: ", err);
    res.status(500).send({
      success: false,
      message: `Error: ${err.message}`,
    });
  }
};
const battorcurrentPosition = async (req, res) => {
  try {
    const userId = req.decoded.userId;
    Bets.aggregate([
      {
        $match: {
          userId: userId,
          status: 1,
          calculateExp: true
        }
      },
      {
        $addFields: {
          'inPlayEventId': { $toObjectId: "$matchId" }
        }
      },
      {
        "$lookup": {
          "from": "inplayevents",
          "localField": "inPlayEventId",
          "foreignField": "_id",
          "as": "matches"
        }
      },
      {
        "$unwind": "$matches"
      },
      {
        $group: {
          _id: "$matches._id",
          "name": {
            "$first": "$matches.name"
          },
          "sportsId": {
            "$first": "$matches.sportsId"
          },
          "Id": {
            "$first": "$matches.Id"
          },
          "marketId": {
            "$first": "$matches.marketIds"
          },
          amount: {
            $sum: "$exposureAmount"
          }
        }
      }
    ], (err, currentPositionData) => {
      if (err) {
        const response = {
          success: false,
          message: 'Failed to get data',
          error: err,
        };
        res.send(response);
      } else {
        const response = {
          success: true,
          message: 'current position records',
          results: currentPositionData
        };
        res.send(response);
      }
    });
  } catch (err) {
    //console.log("current positiion Error ============= ", err);
    const response = {
      success: true,
      message: `current position error ${err}`,
    }
    res.send(response);
  }
}

loginRouter.get('/getCurrentPosition', getCurrentPosition);
loginRouter.get('/currentPositionDetails', currentPositionDetails);
loginRouter.get('/battorcurrentPosition', battorcurrentPosition);
loginRouter.get('/getCurrentPosition2', getCurrentPosition2);
loginRouter.get('/gethighlights', getHighlights);
module.exports = { loginRouter };

