const axios = require("axios");
const { isIterable } = require("../common");
const SESSION_API_URI = `http://142.93.36.1/api/v2`

async function fetchSession(eventId) {
  try {
    // const eventId = '33002177'
    // http://142.93.36.1/api/v2/getSessions?EventTypeID=4&matchId=33061168
    const url = `${SESSION_API_URI}/getSessions?EventTypeID=4&matchId=${eventId}`
    const response = await axios.get(url)
    let res = response.data;
    // console.log('session list: ', JSON.stringify(res))
    if (isIterable(res)) {
      const items = res.map((item) => {
        return JSON.parse(item)
      })
      return items
    } else {
      return []
    }
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
    if (isIterable(res)) {
      const items = res.map((item) => {
        return JSON.parse(item)
      })
      return items
    } else {
      return []
    }
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
    console.error('session api getSessionFancyResult: ', marketIds, error?.data || error.message || error)
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
    console.error('session api getSessionBookmakerResult: ', marketIds, error?.data || error.message || error)
    return []
  }
}

async function fetchBookmakerList(eventId) {
  try {
    // const eventId = '33068371'
    // http://142.93.36.1/api/v2/getBookmakers?EventTypeID=4&EventID=33068371
    const url = `${SESSION_API_URI}/getBookmakers?EventTypeID=4&EventID=${eventId}`
    const response = await axios.get(url)
    // console.log('session list: ', JSON.stringify(res))
    return response?.data ?? [];
  } catch (error) {
    console.error('session api fetchBookmakerList: ',eventId,  error?.data || error.message || error)
    return []
  }
}

async function fetchBookmakerOdds(marketIds) {
  try {
    // const marketId = '1.166536383'
    // const marketId = marketIds.join(',')
    // http://142.93.36.1/api/v2/getBookmakerOdds?EventTypeID=4&marketId=9991.225522065_bm1
    const url = `${SESSION_API_URI}/getBookmakerOdds?EventTypeID=4&marketId=${marketIds}`
    const response = await axios.get(url)
    // console.log('session list: ', JSON.stringify(res))
    const res = response.data
    if (isIterable(res)) {
      const items = res.map((item) => {
        return JSON.parse(item)
      })
      return items
    } else {
      return []
    }
  } catch (error) {
    console.error('session api fetchBookmakerOdds: ', marketIds, error?.data || error.message || error)
    return []
  }
}

async function fetchScore(eventId) {
  try {
    // const marketId = '1.166536383'
    // const marketId = marketIds.join(',')
    // http://142.93.36.1/api/v2/score?EventTypeID=4&matchId=33057044
    const url = `${SESSION_API_URI}/score?EventTypeID=4&matchId=${eventId}`
    const response = await axios.get(url)
    // console.log('session list: ', JSON.stringify(res))
    const res = response.data
    return res
  } catch (error) {
    console.error('session api fetchScore: ', eventId, error?.data || error.message || error)
    return {}
  }
}

module.exports = {fetchSession, fetchMarketOdds, getSessionFancyResult, getSessionBookmakerResult,
  fetchBookmakerList, fetchBookmakerOdds, fetchScore
}
