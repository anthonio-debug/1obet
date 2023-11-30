const express = require('express');
const axios = require('axios');
const router = express.Router();

async function listEvents(req, res) {
    try {
        const apiURL= "http://185.58.225.212:8080/"
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
        res.status(200).json({data: response, msg:'List Events'})
    } catch (err) {
        res.status(500).json({success:false, msg: "Failed to get events"})
    }
}

router.get('/testSportsEvent', listEvents);

module.exports = { router, listEvents };


