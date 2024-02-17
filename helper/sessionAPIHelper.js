const axios = require("axios");
const SESSION_API_URI = `http://142.93.36.1/api/v1`

async function fetchSession(eventId) {
  try {
    // const eventId = '33002177'
    const response = await axios.get(`${SESSION_API_URI}/listMarketBookSession?match_id=${eventId}`)
    let res = response.data;
    // console.log('session list: ', JSON.stringify(res))
    return res || []
  } catch (err) {
    console.error('session api fetchSession: ', error?.data || error.message || error)
    return []
  }
}

async function fetchMarketOdds(marketId) {
  try {
    // const marketId = '1.166536383'
    const response = await axios.get(`${SESSION_API_URI}/listMarketBookOdds?market_id=${marketId}`)
    let res = response.data;
    // console.log('session list: ', JSON.stringify(res))
    return res || []
  } catch (err) {
    console.error('session api fetchMarketOdds: ', error?.data || error.message || error)
    return []
  }
}

module.exports = {fetchSession, fetchMarketOdds}
