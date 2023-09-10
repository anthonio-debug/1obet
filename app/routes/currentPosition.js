const express         = require('express');
const currentPosition = require('../models/CurrentPosition');
const loginRouter     = express.Router();

function getCurrentPosition(req, res) {
  try{
    const userId = req.decoded.userId;
    console.log("userId ======= ", userId);
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

const currentPositionDetails = async (req, res) => {
  try{
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
      // {
      //   "$unwind": "$bets"
      // },
      {
        $group: {
          _id: "$bets.runner",
          marketId: { $first: { $arrayElemAt: ["$bets.marketId", 0] } },
          matchId: { $first: { $arrayElemAt: ["$bets.matchId", 0] } }
          // marketId: { $first: { $arrayElemAt: ["$bets.marketId", 0] } }
          // marketId: { $first: { $arrayElemAt: ["$bets.marketId", 0] } }

          // matchsId: "$matchId",
          // share: "$share",
          // loosingAmount: { $sum: "$amount" },          
          // maxWinningAmount: { $sum: "$bets.loosingAmount" },
          // runner: { $first: { $arrayElemAt: ["$bets.runner", 0] } },
          // marketId: { $first: { $arrayElemAt: ["$bets.marketId", 0] } }

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
  }catch(err){
    console.log("current positiion Error ============= ", err);
    const response = {
      success: true,
      message: `current position error ${err}`,
    }
    res.send(response);
  }
}


/*
{
  "_id": "64fdcd9a63125f9f142ec55a",
  "userId": 1153,
  "description": "some transection name",
  "amount": -2062.5,
  "matchsId": "64fb1afaf8e611afeacbcec8",
  "betId": "64fdcd9a63125f9f142ec553",
  "share": 75,
  "__v": 0,
  "betsId": "64fdcd9a63125f9f142ec553",
  "bets": {
      "_id": "64fdcd9a63125f9f142ec553",
      "sportsId": "4",
      "marketId": "1.218012968",
      "userId": 1154,
      "betAmount": 1000,
      "betRate": 3.75,
      "returnAmount": 0,
      "createdAt": 1694354842711,
      "betSession": null,
      "resultId": null,
      "fancyData": null,
      "isfancyOrbookmaker": false,
      "TargetScore": 0,
      "status": 1,
      "matchId": "64fb1afaf8e611afeacbcec8",
      "winningAmount": 2750,
      "loosingAmount": 1000,
      "subMarketId": "6",
      "event": "Pakistan v India",
      "runner": "7461",
      "position": 0,
      "type": 0,
      "isFake": 0,
      "runnerName": "Pakistan",
      "fancyRate": 0,
      "lastCheckResult": 0,
      "updatedAt": 1694354842711,
      "__v": 0
  }
}
*/


loginRouter.get('/getCurrentPosition', getCurrentPosition);
loginRouter.get('/currentPositionDetails', currentPositionDetails);


module.exports = { loginRouter };

