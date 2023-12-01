const express = require('express');
const axios = require('axios');
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

        if(response.data.result.lengh > 0) {
            for (let i = 0; i < response.result.lengh; i++) {
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


router.get('/testSports/events', listEvents);
router.get('/testSports/marketbooks/:ids', listMarketBook);

module.exports = { router, listEvents, listMarketBook };


