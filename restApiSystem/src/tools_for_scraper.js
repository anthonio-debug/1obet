'use strict';

const axios = require('axios');

const inPlayEvents = require('../../app/models/events');
const Settings = require('../../app/models/settings');
const MarketIDs = require('../../app/models/marketIds');
const {isIterable} = require("../../helper/common");
const {
  getCricketScore
} = require("../../helper/hybridApiHelper");
require('dotenv').config()

const HYBRID_PROVIDER = process.env.HYBRID_PROVIDER || 'pys'

let io;

function ToolForScraper() {
  return {init};

  async function init(_io, express) {
    io = _io;

    fetchCricketScoreFromApi()
  }


  function convertSchema(entity, eventId) {
    const getScore = (score) => {
      const regex = /-?\d+(\.\d+)?/g;
      const matches = score.match(regex) || [0, 0, '0.0'];
      // return `${matches[0]}-${matches[1]} (${over})`;
      return matches
    };
    // const over1 = getScore(entity?.data?.teams[0]?.score)[2]
    // const over2 = getScore(entity?.data?.teams[1]?.score)[2]

    return {
      eventId: eventId,
      seriesKey: entity.seriesKey,
      score: {
        activenation1: 1,
        activenation2: 0,
        balls: 0,
        overScore: 0,
        inning: 1,
        dayno: "",
        isfinished: "0",
        score1: entity?.data?.teams[0]?.score,
        score2: entity?.data?.teams[1]?.score,
        spnballrunningstatus: '',
        spnmessage: "",
        spnnation1: entity?.data?.teams[0]?.team_name,
        spnnation2: entity?.data?.teams[1]?.team_name,
        spnreqrate1: `RRR ${entity?.data?.requireRunRate}`,
        spnreqrate2: `RRR ${entity?.data?.requireRunRate}`,
        spnrunrate1: `CRR ${entity?.data?.currentRunRate}`,
        spnrunrate2: `CRR ${entity?.data?.currentRunRate}`,
      }
    };
  }

  async function fetchCricketScoreFromApi() {
    try {
      const nowTimeStamp = new Date().getTime()
      // const needApiScore = (nowTimeStamp - global.cricketScraperLastupdate) > 5 * 60 * 1000
      const needApiScore = true
      if (!needApiScore) {
        const cricketScoreSourceSetting = await Settings.findOne({
          settingKey: 'CRICKET_SCORECARD_SOURCE'
        })
        if (cricketScoreSourceSetting?.settingValue !== 'API') {
          return
        }
      }
      let inPlayEventList = await inPlayEvents.find({
        sportsId: '4', isShowed: true,
        CompanySetStatus: "OPEN",
        status: 'OPEN',
        inplay: true,
      }, {Id: 1}).exec();
      for (const event of inPlayEventList) {
        const eventId = event.Id
        let cricketScore = await getCricketScore(eventId)
        const score = convertSchema(cricketScore, eventId)
        // io.to('#' + eventId).emit('cricket_score', score);
        io.emit('cricket_score', score);
      }

    } catch (error) {
      console.error("Error fetchCricketScoreFromApi:", error);
    } finally {
      setTimeout(fetchCricketScoreFromApi, 3000)
    }
  }
}

module.exports = ToolForScraper;
