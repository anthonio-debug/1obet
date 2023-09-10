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
          matchId: matchId
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
        "$unwind": "$bets"
      },
      {
        $group: {
          _id: "$runner",
          // matchId: "$matchId",
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

loginRouter.get('/getCurrentPosition', getCurrentPosition);
loginRouter.get('/currentPositionDetails', currentPositionDetails);


module.exports = { loginRouter };
