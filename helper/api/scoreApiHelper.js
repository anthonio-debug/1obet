const {HYBRID_URI} = require("../../app/global/constants");
const axios = require("axios");
require('dotenv').config()
const SCORE_API_URI = `http://103.76.123.249:5500/api`

async function getCricketScoreAPI(eventId) {
  try {
    // const eventId = 32980846
    const response = await axios.get(`${SCORE_API_URI}/LiveScore?match_id=${eventId}`)
    return  response.data
  } catch (error) {
    console.error('getCricketScore: ', error?.data || error.message || error)
    return {}
  }
}

module.exports = { getCricketScoreAPI }
