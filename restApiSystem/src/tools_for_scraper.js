'use strict';

const axios = require('axios');

const inPlayEvents = require('../../app/models/events');
const Settings = require('../../app/models/settings');
const MarketIDs = require('../../app/models/marketIds');
const { isIterable, isObjectEqual } = require('../../helper/common');
const { getCricketScore } = require('../../helper/api/hybridApiHelper');
const { getCricketScoreAPI } = require('../../helper/api/scoreApiHelper');
const { convertApiToCricket, convertCricketToFront } = require('../../helper/schema/cricket');
const Crickets = require('../../app/models/Crickets');
const { calculateSessionNo, calculateBetSession} = require('../../helper/cricket');
const Session = require('../../app/models/Session');
const _ = require('lodash');
const { fetchScoreSessionApi, convertSessionScoreToCricket } = require('../../helper/api/sessionAPIHelper');
const CurrentPosition2 = require("../../app/models/CurrentPosition2");
require('dotenv').config();

const activeCrickets = new Map();

const HYBRID_PROVIDER = process.env.HYBRID_PROVIDER || 'pys';

let io;
async function callBothApis() {
  const scraper = ToolForScraper(); // Initialize ToolForScraper
  await scraper.fetchCricketScoreFromApi(); // Call the first function
  await scraper.fetchCricketScoreFromScoreApi(); // Call the second function
}
function convertSchema(entity, eventId) {
  // 511-10 (144.0) & 17-1 (5.2)
  const parseScore = (score) => {
    const lastScore = score.split('&').pop().trim();
    return lastScore;
  };

  return {
    eventId: eventId,
    seriesKey: entity.seriesKey,
    score: {
      activenation1: 1,
      activenation2: 0,
      balls: [],
      overScore: 0,
      inning: 1,
      dayno: '',
      comment: entity?.data?.msg,
      isfinished: '0',
      score1: parseScore(entity?.data?.teams[0]?.score),
      score2: parseScore(entity?.data?.teams[1]?.score),
      spnballrunningstatus: '',
      spnmessage: '',
      spnnation1: entity?.data?.teams[0]?.team_name,
      spnnation2: entity?.data?.teams[1]?.team_name,
      spnreqrate1: `RRR ${entity?.data?.requireRunRate}`,
      spnreqrate2: `RRR ${entity?.data?.requireRunRate}`,
      spnrunrate1: `CRR ${entity?.data?.currentRunRate}`,
      spnrunrate2: `CRR ${entity?.data?.currentRunRate}`
    }
  };
}

async function fetchCricketScoreFromApi() {
  try {
    const nowTimeStamp = new Date().getTime();
    const needApiScore = nowTimeStamp - global.cricketScraperLastupdate > 6 * 1000;
    // const needApiScore = true
    if (!needApiScore) {
      const cricketScoreSourceSetting = await Settings.findOne({
        settingKey: 'CRICKET_SCORECARD_SOURCE'
      });
      if (cricketScoreSourceSetting?.settingValue !== 'API') {
        return;
      }
    }
    /* temp code start */
    // const cricketScoreSourceSetting = await Settings.findOne({
    //   settingKey: 'CRICKET_SCORECARD_SOURCE'
    // })
    // if (cricketScoreSourceSetting?.settingValue !== 'API') {
    //   return
    // }
    /* temp code end */
    let inPlayEventList = await inPlayEvents
      .find(
        {
          sportsId: '4',
          isShowed: true,
          CompanySetStatus: 'OPEN',
          status: 'OPEN',
          inplay: true
        },
        { Id: 1 }
      )
      .exec();

    for (const event of inPlayEventList) {
      const eventId = event.Id;
      let cricketScore = await getCricketScore(eventId);
      if (cricketScore?.data) {
        const score = convertSchema(cricketScore, eventId);
        // io.to('#' + eventId).emit('cricket_score', score);
        io.emit('cricket_score', score);
      }
    }
  } catch (error) {
    console.error('Error fetchCricketScoreFromApi:', error);
  } finally {
    setTimeout(fetchCricketScoreFromApi, 1000);
  }
}

async function fetchCricketScoreFromScoreApi() {
  try {
    let inPlayEventList = await inPlayEvents
      .find(
        {
          sportsId: '4',
          isShowed: true,
          CompanySetStatus: 'OPEN',
          status: 'OPEN',
          inplay: true
        },
        { Id: 1, player_in: 1 }
      )
      .exec();

    // const cricketScoreSourceSetting = await Settings.findOne({
    //   settingKey: 'CRICKET_SCORECARD_SOURCE'
    // });


    console.log("inPlayEventList for cricket score........",inPlayEventList);

    for (const event of inPlayEventList) {
      const eventId = event.Id;
      let cricketScoreData = null;
      // if (cricketScoreSourceSetting?.settingValue === 'SESSION') {
      //   console.log("if (cricketScoreSourceSetting?.settingValue === 'SESSION') {........................");
      //   cricketScoreData = await fetchScoreSessionApi(eventId);
      // } else {
      //   console.log("if (cricketScoreSourceSetting?.settingValue === 'SESSION') {.ELSE-----------------------------------");
      //   cricketScoreData = await getCricketScoreAPI(eventId);
      // }
      console.log("fetch score for eventid : : : :  : : : ",eventId);
      cricketScoreData = await getCricketScoreAPI(eventId);
      if (cricketScoreData?.data) {
        let apiCricketScore;
        // if (cricketScoreSourceSetting?.settingValue === 'SESSION') {
        //   apiCricketScore = convertSessionScoreToCricket(cricketScoreData, event);
        // } else {
        //   apiCricketScore = convertApiToCricket(cricketScoreData, eventId);
        // }
        console.log("before convertApiToCricket");
        console.log("before convertApiToCricket");
        apiCricketScore = convertApiToCricket(cricketScoreData, eventId);
        console.log("after convertApiToCricket");
        console.log("after convertApiToCricket");
        console.log("after convertApiToCricket",apiCricketScore);
        if (!activeCrickets.has(eventId)){
          console.log("!!!!!!!!!activeCrickets.has(eventId)!activeCrickets.has(eventId)")
        }else{
          console.log("activeCrickets.has(eventId)!activeCrickets.has(eventId)")
        }
        if (!isObjectEqual(activeCrickets.get(eventId), apiCricketScore)){
          console.log("!!!!!!!!!!isObjectEqual(activeCrickets.get(eventId), apiCricketScore)")
        }else{
          console.log("!isObjectEqual(activeCrickets.get(eventId), apiCricketScore)")
        }
        //if (!activeCrickets.has(eventId) || !isObjectEqual(activeCrickets.get(eventId), apiCricketScore)) {
          console.log("1111111111111111111111111111111111111");
          activeCrickets.set(eventId, apiCricketScore);
          const cricketScore = await Crickets.findOneAndUpdate({ eventId: apiCricketScore.eventId }, apiCricketScore, { upsert: true, new: true, setDefaultsOnInsert: true });
          if (eventId) {
            console.log("22222222222222222222222222222222222222222");
            let FindInMe = apiCricketScore.result;
            let FindInMeRes = FindInMe.toLowerCase();
            let findMe1 = FindInMeRes.search('Players IN');
            let findMe2 = FindInMeRes.search('players in');


            if (findMe1 >= 0 || findMe2 >= 0) {

              await inPlayEvents.findOneAndUpdate({ Id: eventId }, { $set: { player_in: 1 } });
            }

            

            const type = cricketScore.type;
            let divider = 5;
            if (type === 'TEST') divider = 10;
            const over = cricketScore.activeTeam === cricketScore.team1ShortName ? cricketScore.over1 : cricketScore.over2;
            const currentOver = parseInt(over?.split('.')[0]);
            const currentBall = parseInt(over?.split('.')[1]);
            console.log("3333333333333333333333333333333333333");
            if (currentOver % divider === 0 && (currentBall === 0 || currentBall === '0')) {
              const score = cricketScore.activeTeam === cricketScore.team1ShortName ? cricketScore.score1 : cricketScore.score2;
              let currentScore = parseInt(score?.split('/')[0]);
              const sessionNo = calculateSessionNo(cricketScore);
              await Session.findOneAndUpdate(
                {
                  eventId: parseInt(eventId),
                  sessionNo: sessionNo
                },
                {
                  $set: {
                    scrap_session_score: `${currentScore}`,
                    score: currentScore,
                    api_session_score: `${currentScore}`
                  }
                }
              );
            }
            console.log("44444444444444444444444444444444");
            /*position2*/
            const sessionNo = calculateBetSession(cricketScore);
            console.log("555555555555555555555555555555555555555555");
            const figureCurrentPositionData2 = await CurrentPosition2.find({
              marketId: '9',
              betSession: sessionNo,
              eventId: eventId
            })
            const cbCurrentPositionData2 = await CurrentPosition2.find({
              marketId: '34',
              betSession: sessionNo,
              eventId: eventId
            })

            const jkCurrentPositionData2 = await CurrentPosition2.find({
              marketId: '10',
              betSession: sessionNo,
              eventId: eventId
            })
            console.log("after convertCricketToFront");
            const frontScore = convertCricketToFront(cricketScore);
            // io.emit('cricket_score_api', frontScore);
            console.log("I am now emitting score to frontend....................");
            console.log("I am now emitting score to frontend....................");
            console.log("I am now emitting score to frontend....................");
            console.log("I am now emitting score to frontend....................");
            console.log("I am now emitting score to frontend....................");
            console.log("I am now emitting score to frontend....................");
            console.log("I am now emitting score to frontend....................");
            console.log("I am now emitting score to frontend....................");


            io.emit('cricket_score_api', {...frontScore, figureCurrentPositionData2, cbCurrentPositionData2, jkCurrentPositionData2, sessionNo});
          }
        //}
      }
    }
  } catch (error) {
    console.error('Error fetchCricketScoreFromScoreApi:', error);
  } 
  finally {
    setTimeout(fetchCricketScoreFromScoreApi, 1000);
  }
}
function ToolForScraper() {
 // return { init , fetchCricketScoreFromApi,fetchCricketScoreFromScoreApi};
  return { init};

  async function init(_io, express) {
    io = _io;

   // fetchCricketScoreFromApi()
   // fetchCricketScoreFromScoreApi();
  }

 
}

// module.exports = {callBothApis,ToolForScraper};
//module.exports = ToolForScraper;
module.exports = callBothApis;