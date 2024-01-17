'use strict';

const axios = require('axios');

const inPlayEvents = require('../../app/models/events');
const FancyEvent = require('../../app/models/fancyEvent');
const FancyOdds = require('../../app/models/fancyOdds');
const MarketIDs = require('../../app/models/marketIds');
const {HYBRID_URI} = require("../../app/global/constants");
const MarketIDS = require("../../app/models/marketIds");

let io;

function ToolForHybridFancy() {
  return {init};

  async function init(_io, express) {
    io = _io;

    getHybridFancyOdds()
  }

  async function getFancyMarketList(eventId) {
    const url = `${HYBRID_URI}/event/fancy?provider=pys&eventid=${eventId}`
    try {
      const res = await axios.get(url)
      // console.log('hybrid fancy event list: ', JSON.stringify(res.data))
      return res.data || []
    } catch (error) {
      console.error('An error occurred:', error?.data || error.message || error)
      return []
    }
  }

  async function getFancyOdds(marketIds) {
    const mids = marketIds.join(',')
    const url = `${HYBRID_URI}/runners/fancy?mids=${mids}&provider=pys`
    try {
      const res = await axios.get(url)
      // console.log('hybrid fancy odd list: ', JSON.stringify(res.data))
      return res.data || []
    } catch (error) {
      console.error('An error occurred:', error?.data || error.message || error);
      return []
    }
  }

  function buildFancyStructure(marketList, fancyOdds, eventId) {
    let t3 = []
    let bm1 = null
    for (const odd of fancyOdds) {
      const market = marketList.find(market => market?.market?.id === odd.marketId)
      t3.push({
        b1: odd.back[0].price,
        b2: odd.back[1].price,
        b3: odd.back[2].price,
        bs1: odd.back[0].size,
        bs2: odd.back[1].size,
        bs3: odd.back[2].size,
        l1: odd.lay[0].price,
        l2: odd.lay[1].price,
        l3: odd.lay[2].price,
        ls1: odd.lay[0].size,
        ls2: odd.lay[1].size,
        ls3: odd.lay[2].size,
        nat: market?.market?.name,
        gstatus: odd.status,
        sid: odd.marketId,
      })
    }
    let fancyData = {
      data: {
        t1: null,
        t2: [{bm1}],
        t3,
        t4: null,
      },
      "eventTypeId": "4",
      "eventTypeName": "cricket",
      "gameId": eventId
    }
    return fancyData
  }

  async function getHybridFancyOdds() {
    try {
      let fancyEvents = await inPlayEvents.find({sportsId: '4', isShowed: true, hasFancy: true}, {Id: 1}).exec();
      for (const event of fancyEvents) {
        const eventId = event.Id
        let marketList = await getFancyMarketList(eventId)
        let marketIds = []
        for (const [index, market] of marketList.entries()) {
          if (index > 25) continue
          marketIds.push(market?.market?.id)
        }
        let fancyOdds = await getFancyOdds(marketIds)
        const fancyData = buildFancyStructure(marketList, fancyOdds, eventId)
        let newFancyOdds = new FancyOdds({
          eventId: eventId,
          marketId: eventId,
          data: fancyData,
        })
        await newFancyOdds.save();
        io.to('#' + eventId).emit('fancy_odds', newFancyOdds);
      }
    } catch (error) {
      console.error("Error getting hybrid fancy odds:", error);
    } finally {
      setTimeout(getHybridFancyOdds, 1000)
    }
  }
}

module.exports = ToolForHybridFancy;
