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
        if(stuckUsers.length > 0) {
            for(let i = 0; i < stuckUsers.length; i++) {
                const activeBetCount = await Bets.countDocuments({userId: stuckUsers[i].userId, status: 1})
                if(activeBetCount > 0) {
                    stuckUsers.pop(e => e.userId == stuckUsers[i].userId)    
                } else {
                    const inActiveBetCount = await Bets.countDocuments({userId: stuckUsers[i].userId, status: 0})
                    stuckUsers[i].betCount = inActiveBetCount;
                }
            }
        }
        res.status(200).json({success: true, data: stuckUsers})
    } catch (err) {
        res.status(500).json({success: false, msg: "Failed to get "})
    }
}

async function activeUserExposure(req, res) {
    try {
        const stuckUsers = await User.find({exposure: {$gte: 0}})
        if(stuckUsers.length > 0) {
            for(let i = 0; i < stuckUsers.length; i++) {
                const activeBetCount = await Bets.countDocuments({userId: stuckUsers[i].userId, status: 1})
                stuckUsers[i].activeBetCount = activeBetCount;
            }
        }
        res.status(200).json({success: true, data: stuckUsers})
    } catch (err) {
        res.status(500).json({success: false, msg: "Failed to get "})
    }
}

router.get('/testSports/events', listEvents);
router.get('/testSports/marketbooks/:ids', listMarketBook);

router.get('/trackstuck/activeusers', activeUserExposure);
router.get('/trackstuck/inactiveusers', inActiveUserExposure);

module.exports = { router, listEvents, listMarketBook, activeUserExposure, inActiveUserExposure };


