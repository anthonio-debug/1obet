const express = require('express');
const Bets = require("../models/bets")
const Users = require("../models/user")
const axios = require('axios');
const User = require('../models/user');
const router = express.Router();
const apiURL= "http://185.58.225.212:8080/api/"

async function listEvents(req, res) {
    try {
        const body = {
            "filter": {
              "textQuery": "string",
              "eventTypeIds": [
                "string"
              ],
              "eventIds": [
                "string"
              ],
              "competitionIds": [
                "string"
              ],
              "marketIds": [
                "string"
              ],
              "venues": [
                "string"
              ],
              "bspOnly": true,
              "turnInPlayEnabled": true,
              "inPlayOnly": true,
              "countryCodes": [
                "string"
              ],
              "marketTypes": [
                "string"
              ],
              "timeRange": {
                "from": "2023-11-30T17:01:35.720Z",
                "to": "2023-11-30T17:01:35.720Z"
              }
            }
          }
        const response = await axios.post(`${apiURL}/listEvents`, body)
        res.status(200).json({success: true, data: response})
    } catch (err) {
        res.status(500).json({success:false, msg: "Failed to get events"})
    }
}

async function listMarketBook(req, res) {
    try {
        const marketIds = req.params.ids
        const response = await axios.get(`${apiURL}listMarketBook/testqms/${marketIds}`)
        let resultArray = [];

        if(response.data.result.length > 0) {
            for (let i = 0; i < response.data.result.length; i++) {
                const odd = {
                    marketId: response.data.result[i].marketId,
                    runners: response.data.result[i].runners
                }
                resultArray.push(odd)
            }
        }
        res.status(200).json({success: true, data: resultArray})
    } catch (err) {
        res.status(500).json({success: false, msg: "Failed to get "})
    }
}

async function inActiveUserExposure(req, res) {
    try {
        const stuckUsers = await User.find({exposure: {$lt: 0}})
        let newResultArray = [];
        if(stuckUsers.length > 0) {
            for(let i = 0; i < stuckUsers.length; i++) {
                const activeBetCount = await Bets.countDocuments({userId: stuckUsers[i].userId, status: 1})
                if(activeBetCount > 0) {
                    // stuckUsers.pop(e => e.userId == stuckUsers[i].userId)    
                    continue;
                } else {
                    const inActiveBetCount = await Bets.countDocuments({userId: stuckUsers[i].userId, status: 0})
                    // console.log(inActiveBetCount)
                    if(inActiveBetCount > 0) {
                      console.log({inActiveBetCount})
                      const newData = {
                        name: stuckUsers[i].userName,
                        userId: stuckUsers[i].userId,
                        exposure: stuckUsers[i].exposure,
                        betCount: inActiveBetCount
                      }
                      newResultArray.push(newData)
                    } else {
                      continue;
                    }
                }
            }
        }
        res.status(200).json({success: true, data: newResultArray})
    } catch (err) {
        res.status(500).json({success: false, msg: "Failed to get "})
    }
}

async function activeUserExposure(req, res) {
    try {
        const stuckUsers = await User.find({exposure: {$gte: 0.1}})
        let newResultArray = []
        if(stuckUsers.length > 0) {
            for(let i = 0; i < stuckUsers.length; i++) {
                const activeBetCount = await Bets.countDocuments({userId: stuckUsers[i].userId, status: 1})
                if(activeBetCount > 0){
                  stuckUsers[i].BetCount = activeBetCount;
                  const newData = {
                    name: stuckUsers[i].userName,
                    userId: stuckUsers[i].userId,
                    exposure: stuckUsers[i].exposure,
                    betCount: activeBetCount
                  }
                  newResultArray.push(newData)
                } else {                  
                  continue;
                }
            }
        }
        res.status(200).json({success: true, data: newResultArray})
    } catch (err) {
        res.status(500).json({success: false, msg: "Failed to get "})
    }
}

async function betStatisticsByUserId(req, res) {
  const userId = req.params.userId;

  try {
    const userStats = await Bets.aggregate([
      {
        $match: { userId: parseInt(userId) } // Match bets for the specific user
      },
      {
        $group: {
          _id: '$marketId',
          totalDifference: { $sum: { $subtract: ['$winningAmount', '$loosingAmount'] } },
          totalExposure: { $sum: { $cond: { if: '$calculateExp', then: '$exposureAmount', else: 0 } } }
        }
      }
    ]);

    res.status(200).json({success: true, data: userStats});
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get "})
  }
}

router.get('/testSports/events', listEvents);
router.get('/testSports/marketbooks/:ids', listMarketBook);

router.get('/trackstuck/activeusers', activeUserExposure);
router.get('/trackstuck/inactiveusers', inActiveUserExposure);

router.get('/track-bet/bet-statistic/:userId', betStatisticsByUserId)

module.exports = { router, listEvents, listMarketBook, activeUserExposure, inActiveUserExposure };


