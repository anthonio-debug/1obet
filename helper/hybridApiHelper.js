const {HYBRID_URI} = require("../app/global/constants");
const axios = require("axios");
require('dotenv').config()

const HYBRID_PROVIDER = process.env.HYBRID_PROVIDER || 'pys'

async function getFancyOdds(marketIds) {
  const mids = marketIds.join(',')
  const url = `${HYBRID_URI}/runners/fancy?mids=${mids}&provider=${HYBRID_PROVIDER}`
  try {
    const res = await axios.get(url)
    // console.log('hybrid fancy odd list: ', JSON.stringify(res.data))
    return res.data || []
  } catch (error) {
    console.error('An error occurred:', error?.data || error.message || error);
    return []
  }
}

async function getBookmakerOdds(marketIds) {
  const mids = marketIds.join(',')
  const url = `${HYBRID_URI}/runners/bookmaker?mids=${mids}&provider=${HYBRID_PROVIDER}`
  try {
    const res = await axios.get(url)
    // console.log('hybrid fancy odd list: ', JSON.stringify(res.data))
    return res.data || []
  } catch (error) {
    console.error('An error occurred in hybrid bookmaker odds:', error?.data || error.message || error);
    return []
  }
}

module.exports = {getFancyOdds, getBookmakerOdds}
