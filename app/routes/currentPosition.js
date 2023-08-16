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

loginRouter.get('/getCurrentPosition', getCurrentPosition);

module.exports = { loginRouter };
