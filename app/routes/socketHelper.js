const config = require('config')
const axios = require('axios')
const FancyGames = require('../models/fancyGames');
const Odds = require('../models/odds');
const inPlayEvents = require('../models/events'); 
const RaceMarkets = require('../models/raceMarkets');
const RaceOdds = require('../models/raceOdds');

/* 
Get data for these sports
   1. Cricket 
   2. Soccer 
   3. Tennis
*/
async function listOdds(eventId) {
    try {
      const odds = await Odds.findOne({ eventId: eventId }).sort({ createdAt: -1 });
      const fancyData = await FancyGames.findOne({ eventId: eventId }).sort({ createdAt: -1 });
      // console.log('odds',odds.runners);

      let liveSportScoreData;

      const event = await inPlayEvents.findOne({ Id: eventIds }, { _id: 0, matchType: 1, sportsId: 1,name:1,openDate:1,status:1,inplay:1 });
      const type = event ? event.sportsId : null;
      if(type == 4){
        liveSportScoreData = await cricketLiveScore(eventId)
      }else{
        liveSportScoreData = await otherLiveScore(eventId)
      }

      return {
        success: true,
        message: 'Records',
        results: {
          odds: odds ? [odds]: [],
          fancyData: fancyData ?  [fancyData]: [],
          livesportscoreData: liveSportScoreData,
          matchData: event
        },
      }
    } catch (error) {
      console.error('Error retrieving odds:', error);
      return {
        success: false,
        message: 'Error retrieving odds',
      };
    }
}

async function cricketLiveScore(id) {
    try {
      const apiResponse =  await   axios.get(`https://livesportscore.xyz:3440/api/bf_scores/${id}`);
      const data = apiResponse.data;
      const response = {};
      if(typeof(data[0]) == "string"){
        const event = await inPlayEvents.findOne({ Id: id }, { _id: 0, matchType: 1, sportsId: 1 });
        const type = event ? event.matchType : null;
        const scoreInfo     = JSON.parse(data).score
        let score           = scoreInfo.score1;
        let played          = scoreInfo.score2;
        response.spnnation1 = scoreInfo.spnnation1;
        response.spnnation2 = scoreInfo.spnnation2;

        if(scoreInfo.activenation1 == 1){
            response.team   =  scoreInfo.spnnation1
            response.crr    = scoreInfo.spnrunrate1.substring(scoreInfo.spnrunrate1.indexOf(' ') + 1).trim()

        }
        else if(scoreInfo.activenation2 == 1){
            response.team    = scoreInfo.spnnation2;
            response.crr     = scoreInfo.spnrunrate2.substring(scoreInfo.spnrunrate2.indexOf(' ') + 1).trim()
            score            = scoreInfo.score2;
            played           = scoreInfo.score1;
        }
          
        response.type   = type
        response.balls  = scoreInfo.balls
  
        if(type == "TEST"){
            score = score.split('&');
            score = score[score.length - 1].trim()
            played = played.split('&');
            played = played[played.length - 1].trim();
        }
        played = played?.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
        played = played.filter(element => element != 0).length;
        if(played > 0){
            response.secondInnings  = 1;
            response.spnmessage =  scoreInfo.spnmessage
             
            if(scoreInfo.activenation2 == 1){
                target = scoreInfo.score1 ? scoreInfo.score1 : ""
            }else if(scoreInfo.activenation1 == 1){
                target = scoreInfo.score2 ? scoreInfo.score2 : ""
            }

            response.target  = (parseInt(target?.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',')[0]) + 1).toString();
            if(scoreInfo.spnreqrate1 != null && scoreInfo.spnreqrate1 != "" ){

                response.rrr = scoreInfo.spnreqrate;

            }
            else if(scoreInfo.spnreqrate2 != null && scoreInfo.spnreqrate2 != ""){

                response.rrr = scoreInfo.spnreqrate2;

            }
        }

        [response.score, response.wickets, response.overs] = score?.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
        return response
      }else{
        return data[0]
      }
    } catch (error) {
        console.error(error);
        return {
            success: false,
            message: 'Failed to get data',
            error: error.message,
        };
    }
}

async function otherLiveScore(id) {
  try {
    const apiResponse =  await   axios.get(`https://livesportscore.xyz:3440/api/bf_scores/${id}`);
    const data        = apiResponse.data;
    if(typeof(data[0]) == "string"){
      const event = await inPlayEvents.findOne({ Id: id }, { _id: 0, matchType: 1, sportsId: 1 });
      return JSON.parse(data)
    }else{
      return data[0]
    }
  } catch (error) {
      console.error(error);
      return {
          success: false,
          message: 'Failed to get data',
          error: error.message,
      };
  }
}

/* 
Get data for these sports
   1. Gray Hound 
   2. Horse Race
*/
async function racesMarketOdds(marketId) {
    try {
      const racesMarketsData = await RaceMarkets.findOne({'eventNodes.marketNodes.marketId': marketId });
      const raceOddsData = await RaceOdds.findOne({ marketId: marketId })
      .sort({ _id: -1 })
  
      console.log('racesMarketsData', racesMarketsData);
      return {
        success: true,
        message: 'Records',
        results: {
          racesMarketsData,
          raceOddsData
        }
      };
    } catch (error) {
      console.error('Error retrieving races:', error);
      return {
        success: false,
        message: 'Error retrieving races',
      };
    }
}

module.exports = { listOdds, racesMarketOdds }