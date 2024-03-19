const axios = require("axios");
const SESSION_API_URI = `http://142.93.36.1/api/v2`

async function fetchSession(eventId) {
  try {
    // const eventId = '33002177'
    // http://142.93.36.1/api/v2/getSessions?EventTypeID=4&matchId=33061168
    const url = `${SESSION_API_URI}/getSessions?EventTypeID=4&matchId=${eventId}`
    const response = await axios.get(url)
    let res = response.data;
    // console.log('session list: ', JSON.stringify(res))
    return JSON.parse(res) || []
  } catch (error) {
    console.error('session api fetchSession: ', eventId, error?.data || error.message || error)
    return []
  }
}

async function fetchMarketOdds(marketId) {
  try {
    // const marketId = '1.166536383'
    // http://142.93.36.1/api/v2/getMarketsOdds?EventTypeID=4&marketId=1.225509710
    const url = `${SESSION_API_URI}/getMarketsOdds?EventTypeID=4&marketId=${marketId}`
    const response = await axios.get(url)
    let res = response.data;
    // console.log('session list: ', JSON.stringify(res))
    return JSON.parse(res) || []
  } catch (error) {
    console.error('session api fetchMarketOdds: ', marketId, error?.data || error.message || error)
    return []
  }
}

async function getSessionFancyResult(marketIds) {
  try {
    // const marketId = '1.166536383'
    const marketId = marketIds.join(',')
    // http://142.93.36.1/api/v2/sessionsResults?EventTypeID=4&marketId=33011518_511,33031567_108
    const url = `${SESSION_API_URI}/sessionsResults?EventTypeID=4&marketId=${marketId}`
    // const url = `${SESSION_API_URI}/marketResult?type=fancy1&market_id=${marketId}`
    const response = await axios.get(url)
    // console.log('session list: ', JSON.stringify(res))
    return response?.data ?? [];
  } catch (error) {
    console.error('session api fetchMarketOdds: ', error?.data || error.message || error)
    return []
  }
}

async function getSessionBookmakerResult(marketIds) {
  try {
    // const marketId = '1.166536383'
    const marketId = marketIds.join(',')
    // http://142.93.36.1/api/v2/bookmakersResults?EventTypeID=4&marketId=9991.225012136_bm1,9991.225012134_bm2
    const url = `${SESSION_API_URI}/bookmakersResults?EventTypeID=4&marketId=${marketId}`
    const response = await axios.get(url)
    // console.log('session list: ', JSON.stringify(res))
    return response?.data ?? [];
  } catch (error) {
    console.error('session api fetchMarketOdds: ', error?.data || error.message || error)
    return []
  }
}

module.exports = {fetchSession, fetchMarketOdds, getSessionFancyResult, getSessionBookmakerResult}
