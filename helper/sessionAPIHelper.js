const axios = require("axios");
const SESSION_API_URI = `http://142.93.36.1/api/v1`

async function fetchSession(eventId) {
  try {
    // const eventId = '33002177'
    const url = `${SESSION_API_URI}/listMarketBookSession?match_id=${eventId}`
    const response = await axios.get(url)
    let res = response.data;
    // console.log('session list: ', JSON.stringify(res))
    return res || []
  } catch (error) {
    console.error('session api fetchSession: ', eventId, error?.data || error.message || error)
    return []
  }
}

async function fetchMarketOdds(marketId) {
  try {
    // const marketId = '1.166536383'
    const url = `${SESSION_API_URI}/listMarketBookOdds?market_id=${marketId}`
    const response = await axios.get(url)
    let res = response.data;
    // console.log('session list: ', JSON.stringify(res))
    return res || []
  } catch (error) {
    console.error('session api fetchMarketOdds: ', marketId, error?.data || error.message || error)
    return []
  }
}

async function getSessionFancyResult(marketIds) {
  try {
    // const marketId = '1.166536383'
    const marketId = marketIds.join(',')
    const url = `${SESSION_API_URI}/marketResult?type=session&market_id=${marketId}`
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
    const url = `${SESSION_API_URI}/marketResult?type=odds&market_id=${marketId}`
    const response = await axios.get(url)
    // console.log('session list: ', JSON.stringify(res))
    return response?.data ?? [];
  } catch (error) {
    console.error('session api fetchMarketOdds: ', error?.data || error.message || error)
    return []
  }
}

module.exports = {fetchSession, fetchMarketOdds, getSessionFancyResult, getSessionBookmakerResult}
