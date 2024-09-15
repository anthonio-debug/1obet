const express = require('express');
const Bets = require("../models/bets")
const Users = require("../models/user")
const InPlayEvents = require("../models/events")
const MarketIDS = require("../models/marketIds")
const Odds = require('../models/odds');
const RaceOdds = require('../models/raceOdds');
const FancyOdds = require('../models/fancyOdds');
const inPlayEventsLithylapi = require('../models/inPlayEventsLithylapi');
const axios = require('axios');
const User = require('../models/user');
const { fetchSession } = require("../../helper/api/sessionAPIHelper");
const router = express.Router();
const apiURL = "http://185.58.225.212:8080/api/"
const apiSystemRacing = require("../../restApiSystem/src/tools_for_updated_racing.js")();
const Session = require('../models/Session');
const inPlayEvents = require('../models/events');
const userBetSizes = require('../models/userBetSizes');
const BetLimits = require('../models/betLimits');
const fancyOdds = require('../models/fancyOdds');
const Deposits = require('../models/deposits.js');
const CasinoCalls = require('../models/casinoCalls.js');
const BetPlaceHold = require('../models/betaPlaceHold.js');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
let config = require('config');
const SubMarketType = require('../models/subMarketTypes.js');
const Crickets = require('../models/Crickets.js');

require('dotenv').config()
// console.log("haaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

function checkRunsOrOvers(inputString) {
  const subMarket = /(runs line|overs line|over line)/i;
  return subMarket.test(inputString);
}
const stopbetStatusChecker = async (id) => {
  try {
    const scores = await Crickets.findOne({ eventId: id });
    //console.log(`Score details ====================== `, scores);
    if (scores && scores?.result && scores?.result?.length) {
      const result = scores?.result.toLowerCase();
      // const stopbetStatus = ["no ball", "noball", "free hit", "freehit",
      //   "thirdumpire", "third umpire", "review", "stumps", "bad", "crowed",
      //   "rain", "suspend", "delay", "pitch", "plood", "injured",
      //   "rain stops play", "bowling review", "stumped", "Run Out Check",
      //   "Bowling Review", "No Ball Check", "LBW Check", "Catch Check",];
      const stopBetStatus = SCORE_API_STATUS_BLOCK_LIST;
      const regexPattern = new RegExp(stopBetStatus.map((word) => `\\b${word.replace(/\s+/g, '\\s+')}\\b`).join('|'), 'i');
      if (regexPattern.test(result)) {
        return 400;
      }
    }
    return 200;
  } catch (error) {
    console.warn(`Error: ${error}`);
    return 200;
  }
};
const handleLimitValue = async (selectedRate, marketId) => {
  if (selectedRate?.toString()?.split('.')?.length == 1 && selectedRate >= 30) return 6;
  else if (selectedRate?.toString()?.split('.')?.length == 1 && selectedRate >= 20) return 3;
  else if (selectedRate >= 10) return 1.5;
  else if (selectedRate >= 6) return 0.6;
  else if (selectedRate >= 4) return 0.3;
  else if (selectedRate >= 3) return 0.15;
  else if (selectedRate >= 2) return 0.06;
  else if (selectedRate >= 1) return 0.03;
};
const getParents = async (userId) => {
  const parentUserIds = [];
  let currentUserId = userId;

  while (currentUserId) {
    const parentUser = await User.findOne({ userId: currentUserId });

    if (!parentUser || !parentUser.createdBy || parentUser.createdBy == currentUserId) {
      break;
    }
    parentUserIds.push(parentUser.createdBy);
    currentUserId = parentUser.createdBy;
  }
  return parentUserIds;
};
const apiCallForOdds = async (marketId,counter) => {
  const url = `${config.sportsAPIUrl}/listMarketBook`;
  const data = { marketIds: [marketId] };
  const header = {
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'X-App': process.env.XAPP_NAME
    }
  };
  const response = await axios.post(url, data, header);
  console.log("}]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]", response?.data?.result);
  console.log("}]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]", counter);
  return response?.data?.result;
};
const placeBet = async (req, res) => {
  // const errors = validationResult(req);
  let statusForRes = {
    betPlaceTime: moment().format('YYYY/MM/DD HH:mm:ss')
  };
  // if (errors.errors.length != 0) {
  //   return res.status(400).send({ errors: errors.errors });
  // }
  try {
    // if (req.decoded.login.role != '5') {
    //   return res.status(401).send({ message: 'You are not allowed to bet' });
    // }
    /* =============================  Base Settings   ============================== */
    let runnerName;
    let currentSession;
    let subMarketDetail;
    let marketId;
    let { selectionId, betAmount, betRate, matchId, subMarketName, type, oddsId, fancyRate, overunderMarketId, selectedAmount, asianOdd, roundId, asianMarketId, rates, partnerValue, timer } = req.body;
    let randomStr = uuidv4();

    // if (parseInt(betRate) > 50) {
    //   return res.status(404).send({
    //     message: `Winning amount can not be more than 50 times than loosing amount`,
    //   });
    // }

    const selectedBetRate = selectedAmount;
    const userId = 21513;
    let ApiResponseOdds;
    let matchedIndex;
    let winningAmount = 0;
    let loosingAmount = 0;
    let isFancyOrBookMaker = false;
    let _3rdPartyMarketId = 0;
    let TargetScore = 0;
    let fancyData = null;
    let runnerForSaveInbets = null;
    let expoisureType = 1;
    const multipeResponse = [];
    const multipeResponseForSecurityCheck = [];
    const BetTime = new Date().getTime();
    let id = 0;
    let isManuel = true;
    let delay = 5200;
    let asianTableName = '';
    let delayAddition = 0;
    let gameStatus = ''
    let matchedResponse = 0;

    if (checkRunsOrOvers(subMarketName)) { subMarketName = "Betfair Fancy" }
    else { subMarketName }

    /* ====================================================================== */

    /* ============================== Innitial Checks  ============================== */

    if (subMarketName.toUpperCase() == 'ZA' || subMarketName.toUpperCase() == 'RSA') {
      //return res.status(404).send({ message: "Betting disabled" });
    }
    if (betAmount < config.betMinimumAmount) {
      return res.status(404).send({ message: `minimum bet should be ${config.betMinimumAmount}` });
    }
    const user = await User.findOne({ userId }).exec();
    if (!user) {
      return res.status(404).send({ message: 'illegal user betting' });
    }

    if (activeBettors.has(userId)) {
      return res.status(404).send({ message: 'Please wait few seconds ' });
    } else {
      activeBettors.set(userId, { status: true });
    }

    // if(user.activeBetPlacing){
    //   return res.status(404).send({ message: "Please wait few seconds " });
    // }else {
    //   user.activeBetPlacing = true;
    //   await user.save();
    // }

    if (user.bettingAllowed == false) {
      activeBettors.delete(userId);
      return res.status(404).send({ message: 'Bet not allowed' });
    }
    let parentUserIds = await getParents(user.userId);

    const blockedUsersCount = await User.countDocuments({ userId: { $in: parentUserIds }, bettingAllowed: false });
    if (blockedUsersCount > 0) {
      activeBettors.delete(userId);
      return res.status(404).send({ message: 'Beting disbaled' });
    }

    const marketIds = await User.distinct('blockedMarketPlaces', {
      userId: { $in: parentUserIds },
      isDeleted: false
    });

    const subMarketId1 = await User.distinct('blockedSubMarkets', {
      userId: { $in: parentUserIds },
      isDeleted: false
    });

    const subMarketId2 = await User.distinct('blockedSubMarketsByParent', {
      userId: { $in: parentUserIds },
      isDeleted: false
    });
    const subMarketId = subMarketId1.concat(subMarketId2);
    let eventDetail;

    if (asianOdd) {
      marketId = '8';
    } else {
      eventDetail = await inPlayEvents.findById(matchId);
      if (!eventDetail) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: 'EVENT COULD NOT FOUND' });
      }

      //console.log("MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM:",subMarketName);
      /*

      if (eventDetail.player_in == 0 && subMarketName != 'Toss' && eventDetail.sportsId == '4') {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: "Players not reached in the ground"});
      }
*/

      if (!eventDetail.betAllowed) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: 'Betting Not Allowd on this Match', data: eventDetail.betAllowed });
      }
      if (eventDetail.status.toUpperCase() != 'OPEN') {
        activeBettors.delete(userId);
        return res.status(404).send({ message: 'Betting Not Allowd on this Match', data: eventDetail.status.toUpperCase() });
      }
      if (eventDetail.matchStopStatus) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: 'Betting Not Allowd on this Match3', data: eventDetail.matchStopStatus });
      }

      if (eventDetail.matchStopStatus) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: 'Betting Not Allowd on this Match' });
      }

      marketId = eventDetail?.sportsId;
    }

    const Digitaddition = await handleLimitValue(betRate, marketId);

    /**
     * checks for Market Sub Market
     * Checks for OpenTime before Start Event
     */
    if (config.raceMarkets.includes(marketId)) {
      const DBOddDetails = await RaceOdds.findById(oddsId);
      if (!DBOddDetails) {
        console.warn(`Error : Odds not found !`);
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-1 `
        });
      }
      const idDetails = await MarketIDS.findOne({ marketId: DBOddDetails.marketId, eventId: eventDetail.Id });
      if (!idDetails) {
        console.warn(`Error : Market details Not found !`);
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-2 `
        });
      }

      const latestRaceOdds = await RaceOdds.find({ marketId: DBOddDetails.marketId }).sort({ createdAt: -1 }).limit(1);

      if (latestRaceOdds) {
        if (latestRaceOdds[0]?.state?.status == 'SUSPENDED' || latestRaceOdds[0]?.state?.status == 'CLOSED') {
          activeBettors.delete(userId);
          return res.status(404).send({ message: 'Bet not allowed' });
        }
      }

      // const requiredTime = new Date().getTime() + config.raceOpenBefore;
      const requiredTime = new Date().getTime() + (subMarketName.toUpperCase() == 'UK' || subMarketName.toUpperCase() == 'US' ? config.ukRaceOpenBefore : config.raceOpenBefore);
      const remainingTimeFromEvent = idDetails.openDate - requiredTime;
      if (remainingTimeFromEvent > 0) {
        activeBettors.delete(userId);
        return res.status(404).send({
          status: true,
          message: `Bets will Allow in 1 : ${Math.ceil(remainingTimeFromEvent / 60000)} min`
        });
      }
      if (subMarketName.toUpperCase() != 'UK') {
        const now = new Date().getTime();
        const remainingTimeFromMarketStart = idDetails.openDate - now;
        if (remainingTimeFromMarketStart < 0) {
          activeBettors.delete(userId);
          return res.status(404).send({ message: 'Bet not allowed' });
        }
      } else if (subMarketName.toUpperCase() == 'UK') {
        if (latestRaceOdds[0]?.state?.status == 'SUSPENDED' || latestRaceOdds[0]?.state?.status == 'CLOSED') {
          activeBettors.delete(userId);
          return res.status(404).send({ message: 'Bet not allowed' });
        }
      }
      id = idDetails.marketId;
      _3rdPartyMarketId = id;
      console.log("Check the marketId", id, "and", _3rdPartyMarketId, "idDetails.marketId", idDetails.marketId);

      subMarketDetail = await SubMarketType.findOne({ countryCode: subMarketName, marketId: marketId }).exec();
      if (!subMarketDetail) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: 'Bet not allowed' });
      }
    } else if (asianOdd) {
      subMarketDetail = await SubMarketType.findOne({ name: subMarketName, marketId: marketId }).exec();
      if (!subMarketDetail) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: 'you cannot place bet' });
      }
    } else {
      let thirdPartyMarketName = subMarketName;
      subMarketDetail = await SubMarketType.findOne({ name: subMarketName, marketId: marketId }).exec();
      const requiredTime = new Date().getTime() + config.sportsOpenBefore;
      const remainingTimeFromEvent = eventDetail.openDate - requiredTime;

      if (subMarketName === 'Toss') {
        const remainingTimeFromEventStart = eventDetail.openDate - new Date().getTime();
        thirdPartyMarketName = 'To Win the Toss';
        const requiredTime = new Date().getTime() - config.tossCloseTime;
        if (subMarketDetail.Id == config.Toss && config.tossCloseTime >= remainingTimeFromEventStart) {
          activeBettors.delete(userId);
          return res.status(404).send({
            status: true,
            message: `Bets are not Allowed Now In this market`
          });
        }
      }

      if (['Winner', 'Cup Winner', 'Cup'].includes(subMarketName)) {
        subMarketName = 'Cup Winner';
      }

      const currentMarket = eventDetail?.marketIds?.find((market) => market.marketName == thirdPartyMarketName);
      id = currentMarket?.id;
      _3rdPartyMarketId = id;
      console.log("_3rdPartyMarketId================= after cup", id, "and", _3rdPartyMarketId, "idDetails.marketId");

      subMarketDetail = await SubMarketType.findOne({
        name: subMarketName,
        marketId: marketId
      }).exec();

      if (!subMarketDetail) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: 'you cannot place bet' });
      }

      if (subMarketDetail.Id != config.Toss && remainingTimeFromEvent > 0) {
        //As I see it runs for cricket,soccer and tennis and did not check for races
        activeBettors.delete(userId);
        return res.status(404).send({
          status: true,
          message: `Bets will Allow in : ${Math.ceil(remainingTimeFromEvent / 60000)} min`
        });
      }
    }

    // const resStatus = await checkMarketActiveForBets(id);
    // if(resStatus === 400){
    //   return res.status(404).send({message: "Betting disabled"});
    // }

    /**
     * Is market Blocked from any Flow
     */
    console.log("44444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444");
    let { blockedSubMarketsByParent } = user;
    let userSubMarketId = subMarketDetail.Id;
    let userEventId = eventDetail.Id
    const blockedSubMarketsByParentBet = blockedSubMarketsByParent.some(item =>
      item.eventId === userEventId &&
      (Array.isArray(item.subMarketId) ? item.subMarketId.includes(userSubMarketId) : item.subMarketId === userSubMarketId)
    );

    if (marketIds.includes(marketId) || subMarketId.includes(subMarketDetail.Id) || user.betLockStatus || blockedSubMarketsByParentBet) {
      activeBettors.delete(userId);
      return res.status(404).send({ message: 'Betting disabled' });
    }

    let maxExp = 0;
    /* ==================================================================== */

    /* ================================== Market Specific Checks ================================== */

    // Soccer Match Odds
    if (config.sportMarkets.includes(marketId) && config.soccerOdds == subMarketDetail.Id) {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const DBOddDetails = await Odds.findById(oddsId);

      if (!DBOddDetails) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }

      if (DBOddDetails?.totalMatched < 20000) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Low volume markets are not allowed to bet`
        });
      }

      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find((runner) => runner.SelectionId == selectionId);
      const diff = getDiffBackAndLay(OddDetailsTeam);
      if (diff > 0.03) {
        //delayAddition = 4;
      }
      runnerName = OddDetailsTeam?.runnerName;

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const oddsData = await apiCallForOdds(id);

          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }

          // const response = await axios.get(url);
          // const oddsData = response.data;
          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          let selectedOddsValue = 0;
          if (type == 0) {
            const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0].price;
            }
            if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          } else if (type == 1) {
            const ApiResponseOdds = runnerFromAPI.ex?.availableToLay;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0]?.price;
            }
            if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      } else if (type == 1 && betRate > selectedBetRate && betRate - Digitaddition > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-3 `
        });
      } else if (type == 0 && selectedBetRate < betRate && selectedBetRate - Digitaddition > betRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-4 `
        });
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-5 `
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-6 `
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue <= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue >= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
       
      }
      matchedResponse = checkMultiResponse(multipeResponse, rates, res)
        if (matchedResponse) {
         var updatedbetRate=matchedResponse
        } else {
          return res.status(404).send({
            message: `Bet miss match `
          });
        }
    }

    // Tennis Match Odds
    else if (config.sportMarkets.includes(marketId) && config.tennisOdds == subMarketDetail.Id) {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }

      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }

      if (DBOddDetails?.totalMatched < 20000) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Low volume markets are not allowed to bet`
        });
      }

      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find((runner) => runner.SelectionId == selectionId);

      const diff = getDiffBackAndLay(OddDetailsTeam);
      if (diff > 0.03) {
        //delayAddition = 4;
      }

      runnerName = OddDetailsTeam?.runnerName;

      console.log ("===============selectedBetRate",selectedBetRate ,"===============betRate", betRate,"teeeeeeeeeeeenis")
      if (selectedBetRate == betRate ) {
        for (let i = 1; i < 5 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);

          const marketStatus = oddsData[0]?.status;
          //console.log("RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR....:",marketStatus);
          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }

          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);

          let selectedOddsValue = 0;
          if (type == 0) {
            const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;

            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0].price;
            }
            if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          } else if (type == 1) {
            const ApiResponseOdds = runnerFromAPI.ex?.availableToLay;

            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0]?.price;
            }
            if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }
        }
        
        
      } else if (type == 1 && betRate > selectedBetRate && betRate - Digitaddition > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-7 `
        });
      } else if (type == 0 && selectedBetRate < betRate && selectedBetRate - Digitaddition > betRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-8 `
        });
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-9 `
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-10 `
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
          /**
           *
           * selectedRate 30
           * Bet Rate 29
           *
           */

          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue <= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates, res)
        if (matchedResponse) {
         var updatedbetRate=matchedResponse
        } else {
          return res.status(404).send({
            message: `Bet miss match AK `
          });
        }

        // LAY:
        // BetRate: 33
        // SelectedRate: 30

        // {

        // 4second API=>
        // 1st second=> 35 => save into array
        // 2nd       => 34 => save into array or donot save
        // 3rd       => 75 => save and move next
        // 4th       => 36 => save or do not save

        // }
        // if array has some values which are lesser than SeleectedRate then take the latest/top most index value.
        // ELSE
        // mistmatch.....
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.Runners.find((runner) => runner.selectionId == selectionId);
          ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue >= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      }
    }

    // Cricket Match Odds
    else if (config.sportMarkets.includes(marketId) && config.cricketOdds == subMarketDetail.Id) {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        name: 'Cricket'
      });

      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      console.log(userMaxBetSize, 'userMaxBetSize', marketId);
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const resultCheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultCheck === 400) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `${message_result}`
        });
      }

      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));

      const OddDetailsTeam = DBOddDetails.runners.find((runner) => runner.SelectionId == selectionId);

      // const diff = getDiffBackAndLay(OddDetailsTeam);
      // if (diff > 0.03) {
      //   // delayAddition = 4;
      // }

      runnerName = OddDetailsTeam?.runnerName;
      /* start of code by qaiser */
      const BetPlaceData = await BetPlaceHold.findOne({
        eventId: DBOddDetails.eventId
      });

      /*end of code by qaiser*/
      delay = (BetPlaceData.secondsValue + delayAddition) * 1000 + 200;
      if (selectedBetRate == betRate || selectedBetRate!=betRate) {
        for (let i = 1; i < BetPlaceData.secondsValue + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const oddsData = await apiCallForOdds(id);
          

          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.runners?.find((runner) => runner.selectionId == selectionId);
          let selectedOddsValue = 0;
          if (type == 0) {
            multipeResponse.push(selectedOddsValue);
            const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0].price;
            }

           

            multipeResponseForSecurityCheck.push(selectedOddsValue);
          } else if (type == 1) {
            multipeResponse.push(selectedOddsValue);
            const ApiResponseOdds = runnerFromAPI.ex?.availableToLay;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0]?.price;
            }
          
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          };
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-11 `
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-2 `
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        // activeBettors.delete(userId)
        // return res.status(404).send({
        //   message: `Bet Miss Matched `,
        // });
        for (let i = 0; i < 4 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
          /**
           *
           * selectedRate 30
           * Bet Rate 29
           *
           */

          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue <= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates, res)


        

        // LAY:
        // BetRate: 33
        // SelectedRate: 30

        // {

        // 4second API=>
        // 1st second=> 35 => save into array
        // 2nd       => 34 => save into array or donot save
        // 3rd       => 75 => save and move next
        // 4th       => 36 => save or do not save

        // }
        // if array has some values which are lesser than SeleectedRate then take the latest/top most index value.
        // ELSE
        // mistmatch.....
      } else if (type == 0 && selectedBetRate != betRate) {
        // activeBettors.delete(userId)
        // return res.status(404).send({
        //   message: `Bet Miss Matched `,
        // });
        for (let i = 0; i < 4 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.runners?.find((runner) => runner.selectionId == selectionId);
          ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue >= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
        // Selected Rate: 30
        // BetRate      : 27

        // {

        // 4second API=>
        // 1st second=> 32 => save or do not save
        // 2nd       => 23 => rejected
        // 3rd       => 31 => save and move next
        // 4th       => 36 => save and move next
        // }

        // if array has some values which are lesser than Selected Rate then take the latest/top most index value.
        // ELSE
        // mismatch.....
      }
     
    }

    // GH HR Match Odds
    else if (config.raceMarkets.includes(marketId)) {
      if (betRate > 50) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Winning amount can not be more than 50 times than loosing amount`
        });
      }
      //isManuel = false;
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      runnerName = req.body.runnerName;
      const DBOddDetails = await RaceOdds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-13 `
        });
      }
      const OddDetailsTeam = DBOddDetails?.runners.find((runner) => runner.selectionId == selectionId);

      const diff = getRaceDiffBackAndLay(OddDetailsTeam);
      if (diff > 3) {
        //delayAddition = 4;
      }

      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.selectionId,
        amount: 0
      }));

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 3 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.horseRaceUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          console.log("Odds Data =======================", oddsData);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          let selectedOddsValue = 0;
          if (type == 0) {
            const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0].price;
            }
            if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          } else if (type == 1) {
            const ApiResponseOdds = runnerFromAPI.ex?.availableToLay;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0].price;
            }
            if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      } else if (type == 1 && betRate > selectedBetRate && betRate - Digitaddition > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-14 `
        });
      } else if (type == 0 && selectedBetRate < betRate && selectedBetRate - Digitaddition > betRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-15 `
        });
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-16 `
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-17 `
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 3 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.horseRaceUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;

          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);

          const ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;

          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue <= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)

        // LAY:
        // BetRate: 33
        // SelectedRate: 30

        // {

        // 4second API=>
        // 1st second=> 35 => save into array
        // 2nd       => 34 => save into array or donot save
        // 3rd       => 75 => save and move next
        // 4th       => 36 => save or do not save

        // }
        // if array has some values which are lesser than SeleectedRate then take the latest/top most index value.
        // ELSE
        // mistmatch.....
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 3 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.horseRaceUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);

          const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;

          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue >= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      }
    }

    // Soccer Over Under
    else if (config.sportMarkets.includes(marketId) && subMarketDetail.Id == config.overUnder) {
      if (parseInt(betRate) > 50) {
        return res.status(404).send({
          message: `Winning amount can not be more than 50 times than loosing amount`
        });
      }

      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      _3rdPartyMarketId = overunderMarketId;
      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find((runner) => runner.SelectionId == selectionId);

      const diff = getDiffBackAndLay(OddDetailsTeam);
      if (diff > 0.03) {
        //delayAddition = 4;
      }

      runnerName = OddDetailsTeam?.runnerName;
      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${overunderMarketId}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;

          const oddsData = await apiCallForOdds(overunderMarketId);

          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }

          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          let selectedOddsValue = 0;
          if (type == 0) {
            const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0].price;
            }
            if (selectedOddsValue && selectedOddsValue != 0 && betRate <= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          } else if (type == 1) {
            const ApiResponseOdds = runnerFromAPI.ex?.availableToLay;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0]?.price;
            }
            if (selectedOddsValue && selectedOddsValue != 0 && betRate >= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      } else if (type == 1 && betRate > selectedBetRate && betRate - Digitaddition > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-18 `
        });
      } else if (type == 0 && selectedBetRate < betRate && selectedBetRate - Digitaddition > betRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-19 `
        });
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-20 `
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-21 `
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${overunderMarketId}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(overunderMarketId);

            const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
            ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
            /**
             *
             * selectedRate 30
             * Bet Rate 29
             *
             */

            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue <= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }

        // LAY:
        // BetRate: 33
        // SelectedRate: 30

        // {

        // 4second API=>
        // 1st second=> 35 => save into array
        // 2nd       => 34 => save into array or donot save
        // 3rd       => 75 => save and move next
        // 4th       => 36 => save or do not save

        // }
        // if array has some values which are lesser than SeleectedRate then take the latest/top most index value.
        // ELSE
        // mistmatch.....
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${overunderMarketId}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(overunderMarketId);

          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue >= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates, res)
        if (matchedResponse) {
         var updatedbetRate=matchedResponse
        } else {
          return res.status(404).send({
            message: `Bet miss match `
          });
        }

        // Selected Rate: 30
        // BetRate      : 27

        // {

        // 4second API=>
        // 1st second=> 32 => save or do not save
        // 2nd       => 23 => rejected
        // 3rd       => 31 => save and move next
        // 4th       => 36 => save and move next
        // }

        // if array has some values which are lesser than SeleectedRate then take the latest/top most index value.
        // ELSE
        // mistmatch.....
      }
    }

    // Cricket Tied Match
    else if (config.sportMarkets.includes(marketId) && subMarketDetail.Id == config.tiedMatch) {
      // if (eventDetail.matchType === 'TEST' && (parseInt(betRate) > 50)) {
      if (parseInt(betRate) > 50) {
        return res.status(404).send({
          message: `Winning amount can not be more than 50 times than loosing amount`
        });
      }

      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        subarket: subMarketDetail.Id
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const resultcheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultcheck === 400) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `${message_result}`
        });
      }
      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find((runner) => runner.SelectionId == selectionId);
      runnerName = OddDetailsTeam?.runnerName;

      const BetPlaceData = await BetPlaceHold.findOne({
        eventId: DBOddDetails.eventId
      });
      delay = BetPlaceData.secondsValue * 1000 + 200;

      if (selectedBetRate == betRate && selectedBetRate != betRate) {
        for (let i = 1; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);

          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }

          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          let selectedOddsValue = 0;
          if (type == 0) {
            const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0].price;
            }
            if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          } else if (type == 1) {
            const ApiResponseOdds = runnerFromAPI.ex?.availableToLay;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0]?.price;
            }
            if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-22 `
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-23 `
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        // activeBettors.delete(userId)
        // return res.status(404).send({
        //   message: `Bet Miss Matched `,
        // });
        for (let i = 0; i < 4; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }

          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue <= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      } else if (type == 0 && selectedBetRate != betRate) {
        // activeBettors.delete(userId)
        // return res.status(404).send({
        //   message: `Bet Miss Matched `,
        // });
        for (let i = 0; i < 4; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }

          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue >= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      }
    }

    // Cricket Cup Winner
    else if (config.sportMarkets.includes(marketId) && subMarketDetail.Id == config.Cup) {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const resultcheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultcheck === 400) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `${message_result}`
        });
      }
      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find((runner) => runner.SelectionId == selectionId);
      runnerName = OddDetailsTeam?.runnerName;

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }

          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          let selectedOddsValue = 0;
          if (type == 0) {
            const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0].price;
            }
            if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          } else if (type == 1) {
            const ApiResponseOdds = runnerFromAPI.ex?.availableToLay;
            if (ApiResponseOdds && ApiResponseOdds.length > 0) {
              selectedOddsValue = ApiResponseOdds[0]?.price;
            }
            if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-25 `
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-26 `
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 4; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue <= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 4; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
          // const response = await axios.get(url);
          // const oddsData = response.data;
          const oddsData = await apiCallForOdds(id);
          const marketStatus = oddsData[0]?.status;

          if (marketStatus != 'OPEN') {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Betting is CLOSED.`
            });
          }
          const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
          ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
          let selectedOddsValue = ApiResponseOdds[0]?.price;
          if (selectedOddsValue >= betRate) {
            multipeResponse.push(selectedOddsValue);
          }
          multipeResponseForSecurityCheck.push(selectedOddsValue);
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      }
    }

    // Cricket Toss
    else if (config.sportMarkets.includes(marketId) && subMarketDetail.Id == config.Toss) {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const resultcheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultcheck === 400) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `${message_result}`
        });
      }
      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find((runner) => runner.SelectionId == selectionId);
      runnerName = OddDetailsTeam?.runnerName;

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const marketStatus = oddsData[0]?.status;

            if (marketStatus != 'OPEN') {
              activeBettors.delete(userId);
              return res.status(404).send({
                message: `Betting is CLOSED.`
              });
            }
            const runnerFromAPI = oddsData[0]?.runners.find((runner) => runner.selectionId == selectionId);
            let selectedOddsValue = 0;
            if (type == 0) {
              const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0].price;
              }
              if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } else if (type == 1) {
              const ApiResponseOdds = runnerFromAPI.ex?.availableToLay;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0]?.price;
              }
              if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            }
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      } else {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet miss matched-27`
        });
      }
    }

    // For Fancy
    else if (config.Fancy == subMarketDetail.Id || config.overByOver == subMarketDetail.Id) {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        subarket: subMarketDetail.Id
      });

      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      // isManuel = false
      subMarketDetail.Id == 7 ? isManuel = false : isManuel = true

      const fancyBetLimit = await userBetSizes
        .findOne({
          userId: userId,
          sportsId: marketId,
          subarket: config.Fancy
        })
        .exec();
      const fancyOddEvenBetLimit = await userBetSizes
        .findOne({
          userId: userId,
          sportsId: marketId,
          subarket: config.overByOver
        }).exec();

      if (!userMaxBetSize) {
        console.warn('Fancy userMaxBetSize not found ');
        activeBettors.delete(userId);
        return res.status(404).send({ message: `something went wrong !` });
      }
      const resultcheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultcheck === 400) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `${message_result}`
        });
      }

      if (fancyBetLimit && betAmount > fancyBetLimit.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is: ${fancyBetLimit.amount}` });
      }

      if (fancyOddEvenBetLimit && betAmount > fancyOddEvenBetLimit.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is: ${fancyOddEvenBetLimit.amount}` });
      }

      isFancyOrBookMaker = true;

      const buildFancyOdd = (apiFancyOddsRes) => {
        let odds = [];
        for (const odd of apiFancyOddsRes) {
          odds.push({
            b1: odd.b1,
            b2: 0,
            b3: 0,
            bs1: odd.bs1,
            bs2: 0,
            bs3: 0,
            l1: odd.l1,
            l2: 0,
            l3: 0,
            ls1: odd.ls1,
            ls2: 0,
            ls3: 0,
            nat: odd.nat,
            gstatus: odd.gstatus,
            sid: odd.sid
          });
        }
        return odds;
      };

      // const eventId = eventDetail.Id;
      // const url = `${FANCY_URL}/bm_fancy/${eventId}`;
      // const response = await axios.get(url);
      // const apiFancyOddsRes = await getFancyOdds([selectionId])
      let apiFancyOddsRes = [];
      // const apiFancyOddsResponse = [];
      let hasError = false; // Flag to manage early exit
      for (let i = 1; i < 4; i++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const response = await fetchSession(eventDetail.Id);

          if (!Array.isArray(response['fanciesArr'])) {
            console.error("Expected an array but got:", response['fanciesArr']);
            return;
          }

          apiFancyOddsRes = response['fanciesArr'].filter((item) => item.sid === selectionId);
          const gameStatus = apiFancyOddsRes[0]?.gstatus;

          if (gameStatus === 'SUSPENDED' || gameStatus === 'Ball Running') {
            activeBettors.delete(userId);

            if (!hasError) {
              hasError = true;
              res.status(404).send({
                message: `Status not available for selected team ${selectionId}-11`
              });
            }
            return; // Exit early to stop further processing
          }
        } catch (error) {
          console.error("Error fetching data:", error);
        }
      }

      const apiFancyOdds = buildFancyOdd(apiFancyOddsRes);
      const DBOddDetails = await FancyOdds.findById(oddsId);
      const dbFancyOdds = DBOddDetails?.data?.data?.t3;

      if (apiFancyOdds?.length && dbFancyOdds?.length) {
        const apiSelectedOdds = apiFancyOdds.find((runner) => runner.sid == selectionId);
        const dbSelectedOdds = dbFancyOdds.find((runner) => runner.sid == selectionId);

        if (!apiSelectedOdds || !dbSelectedOdds) {
          activeBettors.delete(userId);
          return res.status(404).send({
            message: `Odds not available for the selected team ${selectionId}1-`
          });
        }

        fancyData = dbSelectedOdds.nat;
        runnerName = dbSelectedOdds.nat;
        _3rdPartyMarketId = dbSelectedOdds.nat;

        if (userId == 20126) {
          console.log(subMarketName + '------------------------------' + fancyData + '-----------' + marketId + '-UUUUUUUUUUUU-' + userId);
        }

        let oddsInsex = 0;
        if (req.body.type == 0) {
          if (betRate != apiSelectedOdds.l1) {
            activeBettors.delete(userId);
            return res.status(404).send({ message: `Bet miss matched-28 ` });
          }
          const apiBackOdds2 = [apiSelectedOdds.l1, apiSelectedOdds.l2, apiSelectedOdds.l3];
          const apiBackOdds = apiBackOdds2.map((item) => Number(item));
          const DbBackOdds2 = [dbSelectedOdds.l1, dbSelectedOdds.l2, dbSelectedOdds.l3];
          const DbBackOdds = DbBackOdds2.map((item) => Number(item));
          const DbBackScores2 = [dbSelectedOdds.ls1, dbSelectedOdds.ls2, dbSelectedOdds.ls3];
          const DbBackScores = DbBackScores2.map((item) => Number(item));
          const index = DbBackOdds.indexOf(betRate);
          oddsInsex = index;
          TargetScore = betRate;

          if (index == -1) {
            activeBettors.delete(userId);
            return res.status(404).send({ message: `Bet miss matched-29` });
          }
          if (apiBackOdds[index] < betRate) {
            activeBettors.delete(userId);
            return res.status(404).send({ message: `Bet miss matched-30 ` });
          }
        } else if (req.body.type == 1) {
          if (betRate != apiSelectedOdds.b1) {
            activeBettors.delete(userId);
            return res.status(404).send({ message: `Bet miss matched-31 ` });
          }
          const apiBackOdds2 = [apiSelectedOdds.b1, apiSelectedOdds.b2, apiSelectedOdds.b3];
          const apiBackOdds = apiBackOdds2.map((item) => Number(item));
          const DbBackOdds2 = [dbSelectedOdds.b1, dbSelectedOdds.b2, dbSelectedOdds.b3];
          const DbBackOdds = DbBackOdds2.map((item) => Number(item));
          const DbBackScores2 = [dbSelectedOdds.bs1, dbSelectedOdds.bs2, dbSelectedOdds.bs3];
          const DbBackScores = DbBackScores2.map((item) => Number(item));

          const index = DbBackOdds.indexOf(betRate);
          oddsInsex = index;
          TargetScore = betRate;

          if (index == -1) {
            activeBettors.delete(userId);
            return res.status(404).send({ message: `Index miss matched` });
          }
          if (apiBackOdds[index] < betRate) {
            activeBettors.delete(userId);
            return res.status(404).send({ message: `Bet miss matched-32` });
          }
        } else {
          activeBettors.delete(userId);
          return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
        }
        // layFancyRate = [ apiSelectedOdds.l1, apiSelectedOdds.l2, apiSelectedOdds.l3][0];
        // backFancyRate  = [apiSelectedOdds.b1,apiSelectedOdds.b2, apiSelectedOdds.b3][0];
      } else {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Odds not available for the selected team ${req.body.selectionId}-2`
        });
      }
    }


    // For Betfair Fancy 
    else if (subMarketDetail.Id == config.BetfairFancy) {

      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        subarket: subMarketDetail.Id
      });

      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }

      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      isManuel = true;

      const BetfairFancyLimit = await userBetSizes
        .findOne({
          userId: userId,
          sportsId: marketId,
          subarket: config.BetfairFancy
        })
        .exec();

      if (!userMaxBetSize) {
        console.warn('Betfair Fancy userMaxBetSize not found ');
        activeBettors.delete(userId);
        return res.status(404).send({ message: `something went wrong !` });
      }

      const resultcheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultcheck === 400) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `${message_result}`
        });
      }

      if (BetfairFancyLimit && betAmount > BetfairFancyLimit.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is: ${BetfairFancyLimit.amount}` });
      }

      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }

      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));

      const OddDetailsTeam = DBOddDetails.runners.find((runner) => runner.SelectionId == selectionId);
      runnerName = OddDetailsTeam?.runnerName;

      if (selectedBetRate == betRate) {

        for (let i = 1; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              const oddsData = await apiCallForOdds(id);

              const marketStatus = oddsData[0]?.status;
              if (marketStatus !== 'OPEN') {
                activeBettors.delete(userId);
                return res.status(400).send({ message: `Betting is CLOSED.` });
              }

              const runnerFromAPI = oddsData[0]?.runners.find(runner => runner.selectionId == selectionId);

              if (!runnerFromAPI) {
                console.log("Runner not found.");
                return;
              }

              let selectedOddsValue = 0;
              const ApiResponseOdds = type === 0 ? runnerFromAPI?.ex?.availableToBack : runnerFromAPI?.ex?.availableToLay;
              console.log(`Available to ${type === 0 ? 'Back' : 'Lay'}:`, ApiResponseOdds);

              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0].price;
              }

              if ((type === 0 && betRate <= selectedOddsValue) || (type === 1 && betRate >= selectedOddsValue)) {
                multipeResponse.push(selectedOddsValue);
              }

              multipeResponseForSecurityCheck.push(selectedOddsValue);

              console.log(`selectedOddsValue: ${selectedOddsValue}`);

            } catch (error) {
              console.error("Error during API call:", error);
            }
        }
        matchedResponse = checkMultiResponse(multipeResponse, rates,res)
      }
      else {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet miss matched-45`
        });
      }
    }

    // For Bookmaker
    else if (subMarketDetail.Id == config.BookMaker) {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        subarket: subMarketDetail.Id
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const resultCheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultCheck === 400) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `${message_result}`
        });
      }

      isFancyOrBookMaker = true;
      // const eventId = eventDetail.Id;
      // const url = `${FANCY_URL}/bm_fancy/${eventId}`;
      // const response = await axios.get(url);
      const DBOddDetails = await FancyOdds.findById(oddsId);
      const dbFancyOdds = DBOddDetails?.data?.data?.t2[0]?.bm1;
      const selectedMarketId = dbFancyOdds[0]?.ssid;
      if (!selectedMarketId) {
        activeBettors.delete(userId);
        // return res.status(404).send({
        //   message: `Bookmaker Odds not available for the selected team ${selectionId}`
        // });
      }
      // const bookmakerOddsRes = await getBookmakerOdds([selectedMarketId])
      let bookmakerOddsRes = await fetchSession(eventDetail.Id);
      if (bookmakerOddsRes['bookMakerArr'] && bookmakerOddsRes['bookMakerArr'].length > 0) {
        console.log("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:", bookmakerOddsRes['bookMakerArr']);
        console.log("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB length:", bookmakerOddsRes['bookMakerArr'].length);

      } else {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bookmaker Odds not available for the selected team ${selectionId}`
        });
      }



      const bookmakerStatus = bookmakerOddsRes['bookMakerArr']?.some((item) => item?.s === 'ACTIVE');
      const bookmakerSuspendedStatus = bookmakerOddsRes['bookMakerArr']?.every((item) => item?.s === 'SUSPENDED');
      if (bookmakerSuspendedStatus) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bookmaker all runners are in SUSPENDED status for selected team ${selectionId}`
        });
      }
      let bookmakerTeam1 = bookmakerOddsRes['bookMakerArr'][0];
      console.log("----------------------------------->....", bookmakerTeam1.sid);


      const buildBookmakerOdd = (bookmakerOddsRes) => {
        let odds = [];
        const bookmakerOdd = bookmakerOddsRes['bookMakerArr'];
        for (const runner of bookmakerOdd) {
          odds.push({
            b1: runner.b1,
            b2: 0,
            b3: 0,
            bs1: runner.bs1,
            bs2: 0,
            bs3: 0,
            l1: runner.l1,
            l2: 0,
            l3: 0,
            ls1: runner.ls1,
            ls2: 0,
            ls3: 0,
            s: runner.s,
            sid: runner.sid,
            ssid: runner.mid,
            nat: runner.nat
          });

          if (runner.s != 'ACTIVE' && runner.sid == selectionId) {

            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Bookmaker runner is in Ball Running status for selected team ${runner.nat}`
            });

          }

        }
        return odds;
      };
      const apiBookmakerOdds = buildBookmakerOdd(bookmakerOddsRes);


      console.log("apiBookmakerOdds elngth=================================>>>>>", apiBookmakerOdds.length)

      console.log("apiBookmakerOdds runners.....=================================>>>>>", apiBookmakerOdds)







      const bookmakerBallRunningStatus = bookmakerOddsRes['bookMakerArr']?.some((item) => ['Ball Running', 'BALL_RUNNING'].includes(item?.status));

      statusForRes.bookmakerStatus = bookmakerStatus;
      statusForRes.bookmakerBallRunningStatus = bookmakerBallRunningStatus;
      statusForRes.bookmakerSuspendedStatus = bookmakerSuspendedStatus;
      statusForRes.bookmakerBMCheckTime = moment().format('YYYY/MM/DD HH:mm:ss');






      let runners = dbFancyOdds;
      // _3rdPartyMarketId = "Bookmaker";
      _3rdPartyMarketId = selectedMarketId;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.sid,
        amount: 0
      }));

      if (apiBookmakerOdds.length) {
        const apiSelectedOdds = apiBookmakerOdds.find((runner) => runner.sid === selectionId);
        console.log("apiSelectedOdds.b1,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,.......", apiSelectedOdds.b1);
        const dbSelectedOdds = dbFancyOdds.find((runner) => runner.sid === selectionId);


        fancyData = null;
        runnerName = dbSelectedOdds.nat;
        if (req.body.type == 0) {
          if (betRate != apiSelectedOdds.b1) {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Odds not available for the selected team ${selectionId}-5`
            });
          }
          const apiBackOdds2 = [apiSelectedOdds.b1, apiSelectedOdds.b2, apiSelectedOdds.b3];
          const apiBackOdds = apiBackOdds2.map((item) => Number(item));

          const DbBackOdds2 = [dbSelectedOdds.b1, dbSelectedOdds.b2, dbSelectedOdds.b3];
          const DbBackOdds = DbBackOdds2.map((item) => Number(item));

          const DbBackScores2 = [dbSelectedOdds.bs1, dbSelectedOdds.bs2, dbSelectedOdds.bs3];
          const DbBackScores = DbBackScores2.map((item) => Number(item));

          const index = DbBackOdds.indexOf(betRate);
          TargetScore = DbBackScores[index];
          if (index === -1) {
            activeBettors.delete(userId);
            return res.status(404).send({ message: `Index didn't Match` });
          }
          if (apiBackOdds[index] < betRate) {
            activeBettors.delete(userId);
            return res.status(404).send({ message: `Bet miss matched-34` });
          }
        } else if (req.body.type == 1) {
          if (betRate != apiSelectedOdds.l1) {
            activeBettors.delete(userId);
            return res.status(404).send({
              message: `Odds not available for the selected team ${selectionId}-66`
            });
          }
          const apiBackOdds2 = [apiSelectedOdds.l1, apiSelectedOdds.l2, apiSelectedOdds.l3];
          const apiBackOdds = apiBackOdds2.map((item) => Number(item));

          const DbBackOdds2 = [dbSelectedOdds.l1, dbSelectedOdds.l2, dbSelectedOdds.l3];
          const DbBackOdds = DbBackOdds2.map((item) => Number(item));

          const DbBackScores2 = [dbSelectedOdds.ls1, dbSelectedOdds.ls2, dbSelectedOdds.ls3];
          const DbBackScores = DbBackScores2.map((item) => Number(item));

          const index = DbBackOdds.indexOf(betRate);
          TargetScore = DbBackScores[index];

          if (index === -1) {
            activeBettors.delete(userId);
            return res.status(404).send({ message: `Index miss matched` });
          }
          if (apiBackOdds[index] < betRate) {
            activeBettors.delete(userId);
            return res.status(404).send({ message: `Bet miss matched-35` });
          }
        } else {
          return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
        }
      }
    }

    // Figure Even Odd & Small Big
    else if (config.FigureEvenOddSmallBig.includes(subMarketDetail.Id)) {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        subarket: subMarketDetail.Id
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId);
        return res.status(404).send({
          error: 'User Max Bet Size Not Found',
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const resultcheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultcheck === 400) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `${message_result}`
        });
      }
      const FigureEvenOddSmallBig = await userBetSizes
        .findOne({
          userId: userId,
          sportsId: marketId,
          subarket: subMarketDetail.Id
        })
        .exec();
      if (FigureEvenOddSmallBig && betAmount > FigureEvenOddSmallBig.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `max bet size is 13: ${FigureEvenOddSmallBig.amount}`
        });
      }
      const dbscore = await Crickets.find({ eventId: eventDetail.Id }).sort({ _id: -1 }).limit(1);
      const scores = dbscore[0];
      if (!scores) {
        activeBettors.delete(userId);
        return res.status(404).json({
          status: false,
          message: `Bet Not Allowed`
        });
      }
      //console.log(` scores =================== `, scores);
      let type = eventDetail.matchType;
      let inning = parseInt(scores.inning);
      let currentOver = scores.activeTeam === scores.team1ShortName ? scores.over1 : scores.over2;
      let score = scores.activeTeam === scores.team1ShortName ? scores.score1 : scores.score2;
      const wikets = score.split('/')[1];
      if (Number(wikets) === 10) {
        console.warn('Error : Wikets are 10');
        activeBettors.delete(userId);
        return res.status(404).send({
          success: false,
          message: 'betting not allowed on 10 wikets !'
        });
      }
      let sessionAddition = 0;
      const sessionAdditionTimes = inning - 1;
      if (inning !== 1) {
        if (type === 'TEST') {
          sessionAddition = 9 * sessionAdditionTimes;
        } else if (type === 'ODI') {
          sessionAddition = 10 * sessionAdditionTimes;
        } else if (type === 'T20') {
          sessionAddition = 4 * sessionAdditionTimes;
        } else if (type === 'T10') {
          sessionAddition = 2 * sessionAdditionTimes;
        }
      }
      let totalSessions = 0;
      TargetScore = currentOver;
      if (type == 'TEST' && currentOver % 10 == 0) {
        activeBettors.delete(userId);
        console.warn('Error : Overs are 10');
        return res.status(404).send({
          success: false,
          message: 'betting not allowed in Session 10th over !'
        });
      } else if (type != 'TEST' && currentOver % 5 == 0) {
        activeBettors.delete(userId);
        console.warn('Error : Overs are 5');
        return res.status(404).send({
          success: false,
          message: 'betting not allowed in Session 5th over !'
        });
      }

      let currentSessionOver = Math.ceil(currentOver % 5);

      currentSession = Math.ceil(currentOver / 5) + sessionAddition;

      switch (eventDetail.matchType) {
        case 'T10':
          totalSessions = 2;
          break;
        case 'T20':
          totalSessions = 4;
          break;
        case 'ODI':
          totalSessions = 10;
          break;
        case 'TEST':
          totalSessions = 9;
          currentSessionOver = Math.ceil(currentOver % 10);
          currentSession = Math.ceil(currentOver / 10) + sessionAddition;
          break;
        default:
          activeBettors.delete(userId);
          return res.json(404, {
            success: false,
            message: `Match Type is not defined : ${eventDetail.matchType}`
          });
          break;
      }

      if (inning == 2 && currentSession >= totalSessions + sessionAddition) {
        activeBettors.delete(userId);
        console.warn('Error : Sessions  are going Over');
        return res.status(404).send({
          success: false,
          message: 'betting not allowed in last session !'
        });
      } else if ((type == 'TEST' && currentSessionOver > 8) || (type != 'TEST' && currentSessionOver > 3)) {
        activeBettors.delete(userId);
        return res.status(404).send({
          success: false,
          message: `Betting not Allowed in ${type == 'TEST' ? Math.ceil(currentOver % 10) : Math.ceil(currentOver % 5)} over`
        });
      }
      // if (type === "TEST" && scores?.day > 1) {
      //   currentSession = currentSession + 18
      // }
      _3rdPartyMarketId = subMarketDetail.Id;
      //console.log(" ================== currentSession  ", currentSession);
    }

    // For Asian Odd
    else if (marketId == '8') {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId
      });
      //console.log(" Asian Casino Max BetSize ============= ", userMaxBetSize);

      if (!userMaxBetSize) {
        console.warn('userMaxBetSize not found ');
        activeBettors.delete(userId);
        return res.status(404).send({ message: `something went wrong !` });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
      }

      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const DBOddDetails = await AsianMarketOdd.findOne({ roundId: roundId, marketId: asianMarketId });
      if (!DBOddDetails) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }

      let runners = DBOddDetails?.runners;

      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.sid,
        amount: 0
      }));

      const OddDetailsTeam = DBOddDetails.runners.find((runner) => runner.sid == selectionId);
      runnerName = OddDetailsTeam?.nation;

      const asianTableDetail = await AsianTable.findOne({ tableId: oddsId });
      asianTableName = asianTableDetail.tableName;

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5; i++) {
          setTimeout(async () => {
            const url = `${LIVE_BET_TV_URL}/d_rate/${oddsId}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            const playerFromAPI = oddsData.data?.t2.find((player) => player.sid == selectionId);
            let selectedOddsValue = playerFromAPI?.rate;
            if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      } else if (type == 1 && betRate > selectedBetRate && betRate - Digitaddition > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-36 `
        });
      } else if (type == 0 && selectedBetRate < betRate && selectedBetRate - Digitaddition > betRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-37 `
        });
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-38 `
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-39 `
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 4; i++) {
          setTimeout(async () => {
            const url = `${LIVE_BET_TV_URL}/d_rate/${oddsId}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            const playerFromAPI = oddsData.data?.t2.find((player) => player.sid == selectionId);
            let selectedOddsValue = playerFromAPI?.rate;
            if (selectedOddsValue <= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 4; i++) {
          setTimeout(async () => {
            const url = `${LIVE_BET_TV_URL}/d_rate/${oddsId}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            const playerFromAPI = oddsData.data?.t2.find((player) => player.sid == selectionId);
            let selectedOddsValue = playerFromAPI?.rate;
            if (selectedOddsValue >= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      }
      _3rdPartyMarketId = asianMarketId;
      // _3rdPartyMarketId = subMarketDetail.Id;
    } else {
      activeBettors.delete(userId);
      return res.status(404).send({ message: `Error Placing bet (Inappropriate Request)` });
    }
    /* ============================================================ =============== */

    const delayExcludedMarkets = [...config.FigureEvenOddSmallBig, ...config.asianSubMarket, config.Fancy, config.overByOver, config.BetfairFancy, config.BookMaker, config.Toss];

    if (delayExcludedMarkets.includes(subMarketDetail.Id)) {
      delay = 1;
      if (subMarketDetail.Id == config.Fancy || subMarketDetail.Id == config.BookMaker) {
        //delay = 4000;
      }
    } else {
      //delay += delayAddition * 1000;
      delay += 1000;
    }

    setTimeout(async () => {
      if (multipeResponse.length == 0 && !delayExcludedMarkets.includes(subMarketDetail.Id)) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-40 `
        });
      } else if (multipeResponse.length == 0 && !delayExcludedMarkets.includes(subMarketDetail.Id)) {
        betRate = multipeResponse[multipeResponse.length - 1];
      }
      /**
       * Winning Loosing Amounts Calculations
       */
      if (type == 4) {
        winningAmount = betAmount;
        loosingAmount = betAmount;
        selectionId == 0 ? (runnerName = `CHOTA`) : (runnerName = `BARA`);
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 }
        ];
        expoisureType = 2;
      } else if (type == 3) {
        winningAmount = betAmount;
        loosingAmount = betAmount;
        selectionId == 0 ? (runnerName = `KALI`) : (runnerName = `JOTTA`);
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 }
        ];
        expoisureType = 2;
      } else if (type == 2) {
        winningAmount = betAmount * betRate;
        loosingAmount = betAmount;
        runnerName = `Figure(${selectionId})`;
        runnerForSaveInbets = [
          { runner: 0, amount: 0 },
          { runner: 1, amount: 0 },
          { runner: 2, amount: 0 },
          { runner: 3, amount: 0 },
          { runner: 4, amount: 0 },
          { runner: 5, amount: 0 },
          { runner: 6, amount: 0 },
          { runner: 7, amount: 0 },
          { runner: 8, amount: 0 },
          { runner: 9, amount: 0 }
        ];
        expoisureType = 2;
      } else if (type == 1 && !config.ExcludedBackLay.includes(subMarketDetail.Id)) {
        winningAmount = betAmount;
        loosingAmount = betAmount * betRate - betAmount;
      } else if (type == 0 && !config.ExcludedBackLay.includes(subMarketDetail.Id)) {
        winningAmount = betAmount * betRate - betAmount;
        loosingAmount = betAmount;
      } else if (type == 1 && subMarketDetail.Id == config.BookMaker) {
        // ((rate) /100 ) * bet_amount = loosing amount
        loosingAmount = (betRate * betAmount) / 100;
        winningAmount = betAmount;
      } else if (type == 0 && subMarketDetail.Id == config.BookMaker) {
        // ((rate) /100 ) * bet_amount = winning amount
        winningAmount = (betRate * betAmount) / 100;
        loosingAmount = betAmount;
      } else if (type == 0 && config.Fancy == subMarketDetail.Id) {
        loosingAmount = (fancyRate / 100) * betAmount;
        winningAmount = betAmount;
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 }
        ];
      } else if (type == 1 && config.Fancy == subMarketDetail.Id) {
        winningAmount = (fancyRate / 100) * betAmount;
        loosingAmount = betAmount;
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 }
        ];
      } else if (type == 1 && subMarketDetail.Id == config.overByOver) {
        winningAmount = (betRate * betAmount) - betAmount;
        loosingAmount = betAmount;
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 }
        ];
      } else if (type == 0 && subMarketDetail.Id == config.overByOver) {
        winningAmount = betAmount;
        loosingAmount = (betRate * betAmount) - betAmount;
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 }
        ];
      } else if (type == 0 && subMarketDetail.Id == config.BetfairFancy) {
        loosingAmount = betAmount;
        winningAmount = betAmount;
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 }
        ];
      } else if (type == 1 && subMarketDetail.Id == config.BetfairFancy) {
        winningAmount = betAmount;
        loosingAmount = betAmount;
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 }
        ];
      } else if (type == 1 && marketId == 8) {
        winningAmount = betAmount;
        loosingAmount = betAmount * betRate - betAmount;
      } else if (type == 0 && marketId == 8) {
        winningAmount = betAmount * betRate - betAmount;
        loosingAmount = betAmount;
      }

      /* ------------ */
      /**
       * Current Position Of Runners Calculations on bases of Amounts
       */

      let runnersPosition = [];
      let prevExpAmount = 0;
      let expAmount = 0;

      if (config.FancyOddEven.includes(subMarketDetail.Id)) {
        const lastBetsCount = await Bets.countDocuments({
          marketId: _3rdPartyMarketId,
          userId: 21513,
          matchId: matchId,
          fancyData: fancyData,
          status: 1
        });

        if (lastBetsCount > 0) {
          const lastBet = await Bets.find({
            marketId: _3rdPartyMarketId,
            userId: 21513,
            matchId: matchId,
            fancyData: fancyData,
            status: 1
          })
            .sort({ _id: -1 })
            .limit(1);

          const AllRunners = lastBet[0].runnersPosition;
          AllRunners.push(
            ...[
              { runner: Number(TargetScore) - 1, position: 0 },
              { runner: Number(TargetScore), position: 0 },
              { runner: Number(TargetScore) + 1, position: 0 }
            ]
          );
          let selectedAllRunners = AllRunners.map((item) => {
            return { runner: item.runner, position: 0 };
          });

          const AllPreviousBets = await Bets.find({
            marketId: _3rdPartyMarketId,
            userId: 21513,
            matchId: matchId,
            fancyData: fancyData,
            status: 1
          });

          for (const bet of AllPreviousBets) {
            const fancyNewPosition = selectedAllRunners.map((item) => {
              if (bet.type == 1 && item.runner < bet.TargetScore) item.position = Number((item.position - Number(bet.loosingAmount.toFixed(3))).toFixed(3));
              if (bet.type == 1 && item.runner >= bet.TargetScore) item.position = Number((item.position + Number(bet.winningAmount.toFixed(3))).toFixed(3));
              if (bet.type == 0 && item.runner < bet.TargetScore) item.position = Number((item.position + Number(bet.winningAmount.toFixed(3))).toFixed(3));
              if (bet.type == 0 && item.runner >= bet.TargetScore) item.position = Number((item.position - Number(bet.loosingAmount.toFixed(3))).toFixed(3));
              return item;
            });
            selectedAllRunners = fancyNewPosition;
          }
          const runnerCurrentPosition = selectedAllRunners.map((item) => {
            if (type == 1 && item.runner < TargetScore) item.position = Number((item.position - Number(loosingAmount.toFixed(3))).toFixed(3));
            if (type == 1 && item.runner >= TargetScore) item.position = Number((item.position + Number(winningAmount.toFixed(3))).toFixed(3));
            if (type == 0 && item.runner < TargetScore) item.position = Number((item.position + Number(winningAmount.toFixed(3))).toFixed(3));
            if (type == 0 && item.runner >= TargetScore) item.position = Number((item.position - Number(loosingAmount.toFixed(3))).toFixed(3));
            return item;
          });
          runnersPosition = runnerCurrentPosition;
          prevExpAmount = lastBet[0].exposureAmount;
        } else {
          const runners = [
            { runner: Number(TargetScore) - 1, position: 0 },
            { runner: Number(TargetScore), position: 0 },
            { runner: Number(TargetScore) + 1, position: 0 }
          ];
          const runnerCurrentPosition = runners.map((item) => {
            if (type == 1 && item.runner < TargetScore) item.position = -Number(loosingAmount.toFixed(3));
            if (type == 1 && item.runner >= TargetScore) item.position = Number(winningAmount.toFixed(3));
            if (type == 0 && item.runner < TargetScore) item.position = Number(winningAmount.toFixed(3));
            if (type == 0 && item.runner >= TargetScore) item.position = -Number(loosingAmount.toFixed(3));
            return item;
          });
          runnersPosition = runnerCurrentPosition;
        }

        expAmount = runnersPosition.reduce((min, current) => {
          return current.position < min.position ? current : min;
        }, runnersPosition[0]);
        expAmount = expAmount.position;
        expAmount = expAmount < 0 ? Math.abs(expAmount) : 0;
      } else if (expoisureType == 2) {
        const lastBetsCount = await Bets.countDocuments({
          marketId: _3rdPartyMarketId,
          userId: 21513,
          betSession: currentSession,
          matchId: matchId,
          status: 1
        });
        /*  ============================ */
        if (lastBetsCount > 0) {
          const lastBet = await Bets.find({
            marketId: _3rdPartyMarketId,
            userId: 21513,
            betSession: currentSession,
            matchId: matchId,
            status: 1
          })
            .sort({ _id: -1 })
            .limit(1);
          const lastrunnersPosition = lastBet[0].runnersPosition;
          runnersPosition = lastrunnersPosition.map((item) => {
            if (item.runner == selectionId) {
              item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
            } else {
              item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
            }
            return item;
          });
          prevExpAmount = lastBet[0].exposureAmount;
        } else {
          runnersPosition = runnerForSaveInbets.map((item) => {
            if (item.runner == selectionId) {
              item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
            } else {
              item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
            }
            return item;
          });
        }
        expAmount = runnersPosition.reduce((min, current) => {
          return current.amount < min.amount ? current : min;
        }, runnersPosition[0]);
        expAmount = expAmount.amount;
        expAmount = expAmount < 0 ? Math.abs(expAmount) : 0;
        /* ============================= */
      } else if (marketId == '8') {
        const lastBetsCount = await Bets.countDocuments({
          marketId: _3rdPartyMarketId,
          userId: 21513,
          matchId: matchId,
          runner: selectionId,
          status: 1
        });
        if (lastBetsCount) {
          const resp = await asainCalculateExposure(_3rdPartyMarketId, 21513, type, selectionId, loosingAmount, winningAmount, expoisureType, matchId);
          runnersPosition = resp.runnersPosition;
          prevExpAmount = resp.prevExpAmount;
        } else {
          if (type == 0) {
            const runnerCurrentPosition = runnerForSaveInbets.map((item) => {
              if (item.runner == selectionId) {
                item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
              } else {
                item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
              }
              return item;
            });
            runnersPosition = runnerCurrentPosition;
          } else if (type == 1) {
            runnersPosition = runnerForSaveInbets.map((item) => {
              if (item.runner == selectionId) {
                item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
              } else {
                item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
              }
              return item;
            });
          }
        }

        expAmount = runnersPosition.reduce((min, current) => {
          return current.amount < min.amount ? current : min;
        }, runnersPosition[0]);
        expAmount = expAmount.amount;
        expAmount = expAmount < 0 ? Math.abs(expAmount) : 0;
      } else {
        const lastBetsCount = await Bets.countDocuments({
          marketId: _3rdPartyMarketId,
          userId: 21513,
          matchId: matchId,
          status: 1
        });

        console.log("_3rdpartymarketId", _3rdPartyMarketId);
        console.log("matchId", matchId);

        if (lastBetsCount) {
          const resp = await calculateExposure(_3rdPartyMarketId, 21513, type, selectionId, loosingAmount, winningAmount, expoisureType, matchId);

          runnersPosition = resp.runnersPosition;
          prevExpAmount = resp.prevExpAmount;
        } else {
          if (type == 0) {
            const runnerCurrentPosition = runnerForSaveInbets.map((item) => {
              if (item.runner == selectionId) {
                item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
              } else {
                item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
              }
              return item;
            });
            runnersPosition = runnerCurrentPosition;
            console.log("resp======", runnersPosition);
            console.log("runnerForSaveInbets======", runnerForSaveInbets);
          } else if (type == 1) {
            const runnerCurrentPosition = runnerForSaveInbets.map((item) => {
              if (item.runner == selectionId) {
                item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
              } else {
                item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
              }
              return item;
            });
            runnersPosition = runnerCurrentPosition;
          }
        }

        expAmount = runnersPosition.reduce((min, current) => {
          return current.amount < min.amount ? current : min;
        }, runnersPosition[0]);
        expAmount = expAmount.amount;
        expAmount = expAmount < 0 ? Math.abs(expAmount) : 0;
      }
      console.log("expAmount1", expAmount)
      console.log("winningAmount", winningAmount)
      console.log("loosingAmount", loosingAmount)

      let source = req.headers['user-agent'];
      let ua = useragent.parse(source);

      let device;
      if (ua.isMobile || ua.isiPad || ua.isTablet || ua.isiPhone || ua.isAndroid || ua.isMobileNative) {
        device = 'Mobile';
      } else {
        device = 'Computer';
      }

      const realIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      const geoAPIKey = '2dee49c5aad5906aff30a1d0eb8ae024c548fed9';

      let geo = {
        latitude: 0,
        longitude: 0,
        region: null,
        city: null,
        zipCode: null,
        country: null,
        address: null
      };

      try {
        const getGeoInfoUrl = `http://api.db-ip.com/v2/${geoAPIKey}/${realIP}`;

        const getInfo = await axios.get(getGeoInfoUrl);

        if (getInfo?.data) {
          geo.latitude = getInfo.data.latitude;
          geo.longitude = getInfo.data.longitude;
          geo.region = getInfo.data.region;
          geo.city = getInfo.data.city;
          geo.zipCode = getInfo.data.zipCode;
          geo.country = getInfo.data.countryLong;
          geo.address = `${getInfo.data?.district || ''} ${getInfo.data?.city || ''}, ${getInfo.data?.stateProv || ''} ${getInfo.data?.zipCode || ''}, ${getInfo.data?.countryName || ''}`;
        }
      } catch (error) {
        console.warn(error);
      }

      /**
       *  Check for Total calculated Exp should not greater then Allowed
       */
      const finalExpAmount = expAmount - prevExpAmount;
      if (finalExpAmount > maxExp) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: `Max Exposure Amount : ${maxExp}` });
      }

      if (runnerName === 'The Draw' && parseInt(betRate) > 50) {
        return res.status(404).send({
          message: `Winning amount can not be more than 50 times than loosing amount`
        });
      }

      const cricketScore = await Crickets.findOne({ eventId: eventDetail?.Id });
      const matchStatus = cricketScore?.result;
      const matchLastUpdate = cricketScore?.updatedAt;

      let backFancyRate = 0;
      let layFancyRate = 0;
      if (oddsId) {
        const DBOdd = await Odds.findById(oddsId);
        if (DBOdd) {
          const runner = DBOdd?.runners?.filter((item) => item.SelectionId === selectionId)[0];
          if (runner) {
            backFancyRate = runner?.ExchangePrices?.AvailableToBack?.length ? [...runner?.ExchangePrices?.AvailableToBack]?.sort((a, b) => b?.price - a?.price)[0]?.price : 0;
            layFancyRate = runner?.ExchangePrices?.AvailableToLay?.length ? runner?.ExchangePrices?.AvailableToLay[0]?.price : 0;
          }
        }
      }

      if (rates?.length > 1 && !multipeResponseForSecurityCheck.find((e) => rates.includes(e))) {
        activeBettors.delete(userId);
        return res.status(404).send({
          message: `Bet Miss Matched-42 `
        });
      }

      const bet = new Bets({
        marketId: _3rdPartyMarketId || 0,
        sportsId: marketId || 0,
        runnerName: runnerName || 0,
        userId,
        betAmount: betAmount || 0,
        betRate: updatedbetRate?updatedbetRate: Number(betRate) || 0,
        matchType: eventDetail?.matchType,
        matchStatus: matchStatus,
        matchLastUpdate: matchLastUpdate,
        eventId: eventDetail?.Id,
        selectedBetRate: selectedBetRate || 0,
        TargetScore: TargetScore || 0,
        matchId: matchId || null,
        loosingAmount: loosingAmount ? Number(loosingAmount.toFixed(3)) : 0,
        winningAmount: winningAmount ? Number(winningAmount.toFixed(3)) : 0,
        subMarketId: subMarketDetail ? subMarketDetail.Id : 0,
        betSession: currentSession ? currentSession : null,
        runner: selectionId ? selectionId : '',
        type: type || 0,
        status: 1,
        event: eventDetail ? eventDetail.name : oddsId,
        isfancyOrbookmaker: isFancyOrBookMaker,
        fancyData: fancyData,
        fancyRate: fancyRate,
        exposureAmount: expAmount ? Number(expAmount.toFixed(3)) : 0,
        runnersPosition: runnersPosition ? runnersPosition : [],
        ratesRecord: multipeResponseForSecurityCheck ? multipeResponseForSecurityCheck : [],
        betTime: BetTime,
        multipeResponse: multipeResponse ? multipeResponse : [],
        isManuel: isManuel,
        roundId: roundId,
        asianTableName: asianTableName,
        asianTableId: oddsId,
        randomStr: randomStr,
        locationData: geo,
        ipAddress: realIP,
        device: device,
        timer: timer,
        gameStatus: gameStatus,
        backFancyRate,
        layFancyRate,
        rates,
        partnerValue
      });

      let nowUser = await User.findOne({ userId }).exec();
      const lastMaxWithdraw = await Cash.findOne({ userId: userId }).sort({ _id: -1 });

      if (nowUser.availableBalance < expAmount - prevExpAmount || lastMaxWithdraw.availableBalance < expAmount - prevExpAmount) {
        activeBettors.delete(userId);
        return res.status(404).send({ message: ' Insufficient balance amount ' });
      }

      if (config.FancyOddEven.includes(subMarketDetail.Id)) {
        await Bets.updateMany(
          {
            marketId: _3rdPartyMarketId,
            userId: 21513,
            matchId: matchId,
            fancyData: fancyData,
            status: 1
          },
          { calculateExp: false }
        );
      }

      else if (config.FigureEvenOddSmallBig.includes(subMarketDetail.Id)) {
        let setCalculateExpFalse = await Bets.updateMany(
          {
            marketId: _3rdPartyMarketId,
            userId: 21513,
            matchId: matchId,
            betSession: currentSession,
            status: 1
          },
          { calculateExp: false }
        );
        // const latestPreviousbet = await Bets.find({
        //     marketId: _3rdPartyMarketId,
        //     userId: 21513,
        //     matchId: matchId,
        //     betSession: currentSession,
        //     status: 1,
        //   }
        // ).sort({_id: -1}).limit(1);
        // await Exposure.deleteOne({trans_from_id: latestPreviousbet._id})
      } else if (config.asianSubMarket.includes(subMarketDetail.Id)) {
        await Bets.updateMany(
          {
            marketId: _3rdPartyMarketId,
            userId: 21513,
            matchId: matchId,
            roundId: roundId,
            status: 1,
            runner: selectionId
          },
          { calculateExp: false }
        );
        // const latestPreviousbet = await Bets.find(
        //   {
        //     marketId: _3rdPartyMarketId,
        //     userId: 21513,
        //     matchId: matchId,
        //     roundId: roundId,
        //     status: 1,
        //     runner: selectionId
        //   }
        // ).sort({_id: -1}).limit(1);
      } else {
        await Bets.updateMany(
          {
            marketId: _3rdPartyMarketId,
            userId: 21513,
            matchId: matchId,
            status: 1
          },
          { calculateExp: false }
        );
        // const latestPreviousbet = await Bets.find(
        //   {
        //     marketId: _3rdPartyMarketId,
        //     userId: 21513,
        //     matchId: matchId,
        //     status: 1,
        //   }
        // ).sort({_id: -1}).limit(1);
        // await Exposure.deleteOne({trans_from_id: latestPreviousbet._id});
      }

      bet.save(async (err, result) => {
        if (err) {
          console.warn('Error : ', err);
          activeBettors.delete(userId);
          return res.status(404).send({ message: `Something went wrong !` });
        }
        try {
          console.log('Start placing bet');

          const position = new currentPosition({
            userId: userId,
            amount: -Number(loosingAmount.toFixed(3)),
            matchsId: matchId,
            betId: result._id
          });
          await position.save();
          console.log('Position saved', position);

          const nowUser = await User.findOne({ userId }).exec();
          //console.log("User fetched", nowUser);

          const user_prev_balance = nowUser.balance;
          const user_prev_availableBalance = nowUser.availableBalance;
          const user_prev_exposure = nowUser.exposure;

          const totalExpAmount = expAmount - prevExpAmount;
          const UserExpAmountFix = nowUser.exposure + prevExpAmount - expAmount;
          const UserExpAmount = Number(UserExpAmountFix.toFixed(3));
          const UserAvlBalAmountAmt = nowUser.availableBalance + prevExpAmount - expAmount;
          const UserAvlBalAmount = Number(UserAvlBalAmountAmt.toFixed(3));

          await User.findOneAndUpdate(
            { userId: userId },
            {
              exposure: UserExpAmount,
              availableBalance: UserAvlBalAmount
            }
          );
          console.log('User balance updated');
          // Uncomment and debug if necessary
          // let newDeposit = new Cash({
          //   userId: userId,
          //   description: `Bet Place`,
          //   betId: randomStr,
          //   addedExpoisureAmount: expAmount ? expAmount.toFixed(3) : 0,
          //   UserPrevexposure: user.exposure,
          //   UpdatedExposure: UserExpAmount,
          //   sourceCodeBlock: 'Bet Place',
          //   loosingAmount: loosingAmount ? Number(loosingAmount.toFixed(3)) : 0,
          //   winningAmount: winningAmount ? Number(winningAmount.toFixed(3)) : 0,
          //   amount: betAmount || 0,
          //   balance: user.balance,
          //   availableBalance: UserAvlBalAmount,
          //   cashOrCredit: "Bet",
          //   marketId: _3rdPartyMarketId || 0,
          //   sportsId: marketId || 0,
          //   matchId: matchId || null,
          //   betType: type || 0,
          //   betDateTime: BetTime,
          // });
          // await newDeposit.save();
          // console.log("New deposit saved");


          const ExpTran = new Exposure({
            userId: userId,
            trans_from: 'Bet Place',
            trans_from_id: randomStr,
            user_prev_balance: user_prev_balance,
            user_prev_availableBalance: user_prev_availableBalance,
            user_prev_exposure: user_prev_exposure,
            user_new_balance: nowUser.balance,
            user_new_availableBalance: UserAvlBalAmount,
            user_new_exposure: UserExpAmount,
            marketId: _3rdPartyMarketId || 0,
            sportsId: marketId || 0,
            calculatedExp: expAmount ? Number(expAmount.toFixed(3)) : 0,
            DateTime: new Date(),
            calculateExp: 1,
            exposureAmount: expAmount ? Number(expAmount.toFixed(3)) : 0
          });

          await ExpTran.save();
          console.log('Exposure transaction saved');

          await updateParentUserBalance(parentUserIds, winningAmount, matchId, result._id, selectionId, _3rdPartyMarketId, subMarketDetail?.Id);
          console.log('Parent user balance updated');

          activeBettors.delete(userId);

          return res.send({
            success: true,
            message: `Bet placed successfully(${matchedResponse})!`,
            results: result,
            statusForRes,
            delay: delayAddition
          });
        } catch (error) {
          console.warn('error', error);
          activeBettors.delete(userId);
          return res.status(404).send({ message: 'Error updating user balance' });
        }
      });

      /* -------------- */
    }, delay);
  } catch (error) {
    console.warn('Error placing bet Catched ', error);
    const userId = 21513;
    activeBettors.delete(userId);
    return res.status(404).send({ message: `Something went wrong !-1` });
  } finally {
    const userId =21513;
    activeBettors.delete(userId);
    await User.findOneAndUpdate({ userId: userId }, { activeBetPlacing: false });
  }
};

async function listEvents(req, res) {
  try {

    const body = {
      "filter": {
        "textQuery": "string",
        "eventTypeIds": [
          "string"
        ],
        "eventIds": [
          "string"
        ],
        "competitionIds": [
          "string"
        ],
        "marketIds": [
          "string"
        ],
        "venues": [
          "string"
        ],
        "bspOnly": true,
        "turnInPlayEnabled": true,
        "inPlayOnly": true,
        "countryCodes": [
          "string"
        ],
        "marketTypes": [
          "string"
        ],
        "timeRange": {
          "from": "2023-11-30T17:01:35.720Z",
          "to": "2023-11-30T17:01:35.720Z"
        }
      }
    }
    const response = await axios.post(`${apiURL}/listEvents`, body)
    res.status(200).json({ success: true, data: response })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get events" })
  }
}

async function listMarketBook(req, res) {
  try {
    const marketIds = req.params.ids
    const response = await axios.get(`${apiURL}listMarketBook/testqms/${marketIds}`)
    let resultArray = [];

    if (response.data.result.length > 0) {
      for (let i = 0; i < response.data.result.length; i++) {
        const odd = {
          marketId: response.data.result[i].marketId,
          runners: response.data.result[i].runners
        }
        resultArray.push(odd)
      }
    }
    res.status(200).json({ success: true, data: resultArray })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get " })
  }
}

async function inActiveUserExposure(req, res) {
  try {
    const stuckUsers = await User.find({ exposure: { $lt: 0 } })
    let newResultArray = [];
    if (stuckUsers.length > 0) {
      for (let i = 0; i < stuckUsers.length; i++) {
        const activeBetCount = await Bets.countDocuments({ userId: stuckUsers[i].userId, status: 1 })
        if (activeBetCount > 0) {
          // stuckUsers.pop(e => e.userId == stuckUsers[i].userId)
          continue;
        } else {
          const inActiveBetCount = await Bets.countDocuments({ userId: stuckUsers[i].userId, status: 0 })
          // //console.log(inActiveBetCount)
          if (inActiveBetCount > 0) {
            //console.log({inActiveBetCount})
            const newData = {
              name: stuckUsers[i].userName,
              userId: stuckUsers[i].userId,
              exposure: stuckUsers[i].exposure,
              betCount: inActiveBetCount
            }
            newResultArray.push(newData)
          } else {
            continue;
          }
        }
      }
    }
    res.status(200).json({ success: true, data: newResultArray })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get " })
  }
}

async function activeUserExposure(req, res) {
  try {
    const stuckUsers = await User.find({ exposure: { $gte: 0.1 } })
    let newResultArray = []
    if (stuckUsers.length > 0) {
      for (let i = 0; i < stuckUsers.length; i++) {
        const activeBetCount = await Bets.countDocuments({ userId: stuckUsers[i].userId, status: 1 })
        if (activeBetCount > 0) {
          stuckUsers[i].BetCount = activeBetCount;
          const newData = {
            name: stuckUsers[i].userName,
            userId: stuckUsers[i].userId,
            exposure: stuckUsers[i].exposure,
            betCount: activeBetCount
          }
          newResultArray.push(newData)
        } else {
          continue;
        }
      }
    }
    res.status(200).json({ success: true, data: newResultArray })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get " })
  }
}

async function betStatisticsByUserId(req, res) {
  const userId = req.params.userId;

  try {
    const userStats = await Bets.aggregate([
      {
        $match: { userId: parseInt(userId) } // Match bets for the specific user
      },
      {
        $group: {
          _id: "$marketId",
          betIds: { $addToSet: "$_id" },
          totalDifference: { $sum: { $subtract: ["$winningAmount", "$loosingAmount"] } },
          totalExposure: { $sum: { $cond: { if: "$calculateExp", then: "$exposureAmount", else: 0 } } },
          winningAmounts: { $addToSet: { $cond: { if: "$calculateExp", then: "$winningAmount", else: 0 } } },
          loosingAmounts: { $addToSet: { $cond: { if: "$calculateExp", then: "$loosingAmount", else: 0 } } },
          totalPosition: { $sum: { $cond: { if: "$calculateExp", then: "$position", else: 0 } } },
          events: { $addToSet: "$event" },
          runnerNames: { $addToSet: "$runnerName" },
        },
      },
      {
        $project: {
          marketId: "$_id",
          betIds: "$betIds",
          totalDifference: "$totalDifference",
          totalExposure: "$totalExposure",
          winningAmounts: "$winningAmounts",
          loosingAmounts: "$loosingAmounts",
          totalPosition: "$totalPosition",
          events: "$events",
          runnerNames: "$runnerNames",
        }
      }
    ]);

    res.status(200).json({ success: true, data: userStats });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getCricketScore(req, res) {
  try {
    // const eventId = 32981327
    const response = await axios.get('http://167.99.198.2/api/matches/score/32981327')
    let resultArray = response;
    res.status(200).json({ success: true, data: resultArray })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get " })
  }
}

async function testAPI(req, res) {
  const marketId = req.params.marketId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "marketIds": [marketId]
      // "maxResults": 100,
      // "maxResults": 100,
      // "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
    }
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getMarketsByEventId(req, res) {
  const eventId = req.params.eventId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-App": process.env.XAPP_NAME,
        "Cache-Control": "no-cache"
      },
    };
    const requestData = {
      filter: {
        eventIds: [eventId],
      },
      maxResults: 200,
      marketProjection: [
        "EVENT",
        "EVENT_TYPE",
        "MARKET_START_TIME",
        "MARKET_DESCRIPTION",
        "RUNNER_DESCRIPTION",
      ],
    };
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const response = await axios.post(url, requestData, header);

    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + err.message });
  }
}

async function getEventsBySportsId(req, res) {
  const sportsId = req.params.sportsId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "filter": {
        eventTypeIds: [sportsId]
      },
    }
    var url = `${sportsAPIUrl}/listEvents`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getOddsByMarketId(req, res) {
  const marketId = req.params.marketId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "marketIds": [marketId]
    }
    var url = `${sportsAPIUrl}/listMarketBook`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}
async function getOddsByMarketId2(req, res) {
  const marketId = req.params.marketId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "marketIds": [marketId]
    }
    var url = `${sportsAPIUrl}/listMarketBook`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getMarketType(req, res) {
  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "filter": {
        eventIds: []
      }
    }
    var url = `${sportsAPIUrl}/listMarketTypes`;

    const response = await axios.post(
      url,
      requestData,
      header
    );
    const marketsData = response.data;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getOddsByMultiMarketId(req, res) {
  const eventId = req.params.eventId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "filter": {
        eventIds: [eventId]
      },
      "maxResults": 10,
      "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
    }
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const marketResponse = await axios.post(
      url,
      requestData,
      header
    );

    let marketIds = [];
    for (let i = 0; i < marketResponse?.data?.result?.length; i++) {
      marketIds.push(marketResponse?.data?.result[i].marketId + "")
    }

    const oddsRequestData = {
      "marketIds": marketIds
    }
    var oddsUrl = `${sportsAPIUrl}/listMarketBook`;

    const oddsResponse = await axios.post(
      oddsUrl,
      oddsRequestData,
      header
    );

    const marketsData = oddsResponse?.data?.result;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getTodayEventsBySportsId(req, res) {
  try {
    let sportsId = req.params.sportsId
    var now = new Date();  // Get the current date and time
    var startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    var startOfDayTimestamp = startOfDay.getTime();

    var endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    var endOfDayTimestamp = endOfDay.getTime();

    const events = await inPlayEvents.find(
      {
        sportsId: sportsId,
        status: "OPEN",
        openDate: { $gte: startOfDayTimestamp, $lt: endOfDayTimestamp }
      },
      {
        _id: 1,
        Id: 1,
        name: 1,
        openDate: { $toDate: "$openDate" }
      }
    );

    let data = [];

    for (let k = 0; k < events?.length; k++) {
      data.push({
        _id: events[k]._id,
        Id: events[k].Id,
        name: events[k].name,
        openDate: new Date(events[k].openDate)
      })
    }
    res.status(200).json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getMarketsByMarketType(req, res) {
  const eventId = req.params.eventId;
  const marketTypes = req.params.marketTypes?.split(",");

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    let requestData

    if (marketTypes?.length > 0) {
      requestData = {
        "filter": {
          eventIds: [eventId],
          marketTypes: marketTypes
        },
        "maxResults": 100,
        "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
      }
    } else {
      requestData = {
        "filter": {
          eventIds: [eventId],
        },
        "maxResults": 10,
        "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
      }
    }

    //console.log("---------------------->", requestData)
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const marketResponse = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = marketResponse?.data?.result;

    res.status(200).json({ success: true, data: marketsData });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function getFanciesByEventId(req, res) {
  const eventId = req.params.eventId;
  const gtype = req.query.gtype;
  // console.log("gtype===================================", gtype);
  // console.log("eventId===================================", eventId);
  try {
    let sessions = await fetchSession(eventId)
    if (gtype) {
      sessions = sessions.filter(item => item.gtype === gtype)
    }

    res.status(200).json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message })
  }
}

async function fetchEvents(req, res) {
  const sportsId = req.params.sportsId;
  try {
    await apiSystemRacing.fetchRacingEvent(sportsId)
    res.status(200).json({ success: true, message: `Fetched successfully with sportsId: ${sportsId}` });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to get Error: ${err}` })
  }
}

async function getEventList(req, res) {
  const { sportsId, from, to } = req.body;
  try {
    const now = new Date()
    const fromTimestamp = new Date(now.getTime() - (Number(from) * 24 * 60 * 60 * 1000))
    const someHoursLater = new Date(now.getTime() + (Number(to) * 24 * 60 * 60 * 1000))
    const toTimeStamp = someHoursLater.getTime()

    const events = await InPlayEvents.find({
      sportsId: `${sportsId}`,
      openDate: { $gte: fromTimestamp, $lte: toTimeStamp },
    })

    res.status(200).json({ success: true, results: events });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to get Error: ${err}` })
  }
}
async function closeOpenMarkets(req, res) {


  try {


    res.status(200).json({ success: true, data: 'Testing.....' })
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get " })
  }

}

async function getMarketsLimitlessByEventId(req, res) {
  const eventId = req.params.eventId;
  // const url = `http://142.93.36.1/api/v2/getMarkets?EventTypeID=4&EventID=${eventId}`;
  const url = `http://84.8.153.51/api/v2/getMarkets?EventTypeID=4&EventID=${eventId}`;
  try {
    const response = await axios.get(url);
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + error.message });
  }
}

async function getMarketsLimitlessByEventId2(req, res) {
  const eventId = req.params.eventId;
  const url = `http://84.8.153.51/api/v2/getSessions?EventTypeID=4&matchId=${eventId}`;
  try {
    const response = await axios.get(url);
    const data = []
    for (const item of response.data) {
      data.push(JSON.parse(item))
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + error.message });
  }
}

async function getBookmakersLimitlessByEventId(req, res) {
  const eventId = req.params.eventId;
  const url = `http://84.8.153.51/api/v2/getBookmakers?EventTypeID=4&EventID=${eventId}`;
  try {
    const response = await axios.get(url);
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + error.message });
  }
}

async function getOddsLimitlessByMarketId(req, res) {
  const marketId = req.params.marketId;
  const url1 = `http://84.8.153.51/api/v2/getMarketsOdds?EventTypeID=4&marketId=${marketId}`;
  const url2 = `http://sportzing.in:5505/api/getOdds?market_id=${marketId}`;

  try {

    let response = await axios.get(url1);
    console.log("Response from first API:", JSON.stringify(response.data, null, 2));

    if (!response || !response.data || Object.keys(response.data).length === 0) {
      console.log("No data from first API, calling second API...");
      response = await axios.get(url2);
    }

    res.status(200).json({ success: true, message: "response from lithyl api", data: response.data });

  } catch (error) {
    console.error("Error from first API:", error.message);
    // Second API call
    try {
      let response = await axios.get(url2);
      // console.log("Response from second API after first API failure:", JSON.stringify(response.data, null, 2));
      res.status(200).json({ success: true, message: "response from lithyl api", data: response.data });

    } catch (error2) {
      console.error("Error from second API:", error2.message);
      res.status(500).json({ success: false, msg: "Failed to get odds: " + error2.message });
    }
  }
}


async function getScoreLimitlessByEventId(req, res) {
  const eventId = req.params.eventId;

  const url = `http://84.8.153.51/api/v2/score?EventTypeID=1&matchId=${eventId}`;
  try {
    const response = await axios.get(url);
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, msg: "Failed and Error: " + error.message });
  }
}

async function createMissingSessions(req, res) {
  totalSession = 20;


  for (let i = 8; i < totalSession; i++) {
    const session = new Session({
      sessionNo: i,
      eventId: 33347567,
      Id: '666c4091a8b2218c182e8379',
      createdAt: 1718399592994,
      updatedAt: 1718399592994,
      manuelSave: false
    });
    session.save();
  }


}


async function TestTrial(req, res) {

  const eventId = req.params.eventId;

  try {


    let FindInMe = "Yes here you can Player in 1 find my string";
    let FindInMeRes = FindInMe.toLowerCase();
    let findMe1 = FindInMeRes.search("player in");
    let findMe2 = FindInMeRes.search("players in");



    if (findMe1 > 0 || findMe2 > 0) {

      await InPlayEvents.updateMany(
        { Id: eventId },
        { $set: { player_in: 1 } }
      )
      res.status(200).json({ success: true, message: 'Event updated successfully.' });
    } else {
      await InPlayEvents.updateMany(
        { Id: eventId },
        { $set: { player_in: 0 } }
      )
      res.status(200).json({ success: true, message: 'Event update failed.' });
    }


  } catch (error) {
    console.error('Error updating odds:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }

}

async function deleteOdds(req, res) {
  const eventId = req.params.eventId;

  try {
    //await Bets.deleteMany({marketId:'1.232738763bm',eventId:'33564157',marketName:'Bookmaker'});
    await Odds.deleteMany({});
    await RaceOdds.deleteMany({});
    await fancyOdds.deleteMany({});
    // await MarketIDS.deleteMany({
    //   marketName: { $regex: /Overs Line|Runs Line/ }
    // });
    await MarketIDS.deleteMany({sportID:1,status:'CLOSED'});
    await MarketIDS.deleteMany({sportID:2,status:'CLOSED'});
    await MarketIDS.deleteMany({sportID:4,status:'CLOSED'});
    //await MarketIDS.deleteMany({sportID:4339});
    
    //await InPlayEvents.updateMany({ Id: eventId }, { $set: { hasFancy: true } });
    // await MarketIDS.updateMany({ eventId: eventId }, { $set: { ReadyForOdds: true } });
    const response = await MarketIDS.aggregate([{ $project: { name: "$marketName" } }]);

    const totalMarkets = await MarketIDS.countDocuments({ sportID: 4 });

    var arra = [];
    for (let index = 0; index < response.length; index++) {
      var element = response[index];
      // console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++" + element);
      //arra[index] = element.name;
    }
    if (Array.isArray(element)) {
      console.log("Element is an array", element.map(data => console.log(data)));
    } else if (element !== null && typeof element === 'object') {
      console.log("Element is an object");
    } else {
      console.log("Element is neither an array nor an object");
    }

    const totalgreyhound = await MarketIDS.countDocuments({ winnerInfo: null, sportID: 4339 });
    // console.log(`totalgreyhound================${totalgreyhound}`);
    const totalhorses = await MarketIDS.countDocuments({ winnerInfo: null, sportID: 7 });
    // console.log(`totalhorses================${totalhorses}`);

    res.status(200).json({
      success: true,
      message: `Odds deleted successfully. Last processed element: ${element} --- totalMarkets:: ${totalMarkets}`,
    });
  } catch (error) {
    console.error('Error updating odds:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function deleteDepositsAndCasinoCalls(req, res) {
  const userId = req.params.userId
  await Deposits.deleteMany({
    userId: userId,
    description: { $regex: "Casino", $options: "i" } // Case-insensitive search for "Casino"
  })
    .then(result => {
      console.log(`${result.deletedCount} deposit(s) deleted.`);

    })
    .catch(err => {
      console.error("Error deleting deposits:", err);
    });

  await CasinoCalls.deleteMany({
    username: "user_" + userId
  })

  return res.status(200).json({ message: `${userId} records deleted in casino and deposits` })

}

async function getRelatedMarkets(req, res) {
  const { marketId, sportid } = req.params;
  const sportId = +sportid
  // console.log(typeof sportId);
  // const currentDate=  Date.now()
  try {
    const market = await MarketIDS.findOne({ marketId: marketId })
    const marketOpendate = market.openDate;

    const marketData = await MarketIDS.aggregate([
      {
        $match: { sportID: sportId, openDate: { $gt: marketOpendate } }
      },
      {
        $lookup: {
          from: 'raceodds',
          localField: 'marketId',
          foreignField: 'marketId',
          as: 'oddsData'
        }
      },
      {
        $lookup: {
          from: 'inplayevents',
          localField: 'eventId',
          foreignField: 'Id',
          as: 'event'
        }
      },
      {
        $project: {
          _id: 1,
          sportID: 1,
          eventId: 1,
          marketId: 1,
          Name: "$marketName",
          countryCode: { $first: '$event.countryCode' },
          openDate: 1,
          status: 1,
          totalMatched: { $arrayElemAt: ['$oddsData.totalMatched', 0] }
        }
      },
      { $sort: { openDate: 1 } },
      { $limit: 5 },


    ]);
    // console.log(".....................................", marketData);
    res.status(200).json({ success: true, message: 'Related Markets:', marketData });
  } catch (error) {
    console.error('Error updating odds:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
async function saveOdds(oddData, sportsId) {
  console.log("MM befor parsing-=-=-=-=-=-=-", oddData)
  //   try {
  //     oddData = JSON.parse(oddData);
  // } catch (error) {
  //     console.error("Failed to parse oddData:", error);
  //     return;
  // }
  if (Array.isArray(oddData) && oddData.length > 0) {
    oddData = oddData[0];
  } else {
    console.error("Invalid oddData format:", oddData);
    return;
  }

  console.log("MMMMMMMMMMMMMMM-=-=-=-=-=-=-", oddData.marketId)


  const oddDataMarket = await MarketIDS.findOne({ marketId: oddData.marketId })
  const runnerNameMap = new Map();
  
  for (const runner of oddDataMarket.runners) {
    runnerNameMap.set(runner.SelectionId, runner.runnerName);
  }

  
  const runners = [];
  const oddsExist=  await Odds.findOne({marketId: oddData.marketId })
  
  console.log("---------------oddsExist------------",oddsExist);
  if(!oddsExist){
    console.log("---------------oddsExist------------ iff block runnig");
    
  for (const runner of oddData.runners) {
    console.log("oddDataMarket.runners.runnerName", runnerNameMap.get(runner.selectionId));
    runners.push({
      SelectionId: runner.selectionId,
      runnerName: runnerNameMap.get(runner.selectionId),
      Status: runner.status,
      LastPriceTraded: runner.lastPriceTraded,
      TotalMatched: 0,
      ExchangePrices: {
        AvailableToBack: runner.ex?.availableToBack,
        AvailableToLay: runner.ex?.availableToLay,
      },
    });
  }
  // console.log("MMMMMMMMMMMMMMM-=-=-=-=-=-=-  runners",runners)



  // console.log("????????????????",oddData.eventid);
  const activeRunners = runners.filter((e) => e.Status === "ACTIVE");

  const odd = {
    eventId: oddData.eventid,
    marketId: oddData.marketId,
    status: oddData.status,
    isInplay: oddData.inplay,
    totalMatched: oddData.totalMatched,
    isMarketDataDelayed: false,
    sportsId,
    numberOfRunners: runners.length,
    numberOfActiveRunners: activeRunners.length,
    runners,
  };

  const odds = new Odds(odd);
  await odds.save()
  
  // .then(result => {
  //   console.log("RRRRRRRrrrr result", result);

  // }).catch(err => {
  //   console.log("EEEEEEEEEEEr errror", err);

  // })
  // console.log("=-=-==-=-=-====-=- odds saved");
  return odd;
}else{
  console.log("{{{{{{{{ updating marketPlce odds")
  const odd=  await Odds.findOneAndUpdate({marketId: oddData.marketId }, {$set:{totalMatched: oddData.totalMatched,}})
  return odd
}


}

// async function getOdds(marketIds, sportsId) {
//   return new Promise((resolve, reject) => {
//     const odds = [];
//     const oddUrl = `http://84.8.153.51/api/v2/getMarketsOdds?EventTypeID=${sportsId}&marketId=${marketIds}`;
//     axios
//       .get(oddUrl)
//       .then(async (oddRes) => {
//         if (!oddRes || !oddRes?.data) return;
//         if (oddRes.data.length) {
//           console.log("===================================================================================1");
//           for (const item of oddRes.data) {
//             const oddData = JSON.parse(item);
//             odds.push(await saveOdds(oddData, sportsId));
//           }
//         } else {
//           const oddData = JSON.parse(oddRes.data);
//           console.log("===================================================================================2");
//           odds.push(await saveOdds(oddData, sportsId));
//         }
//         resolve(odds);
//       })
//       .catch((error) => {
//         console.log("error", error.response.data);
//         resolve([]);
//       });
//   });
// }

//////////////////////////////////////////////////////////////////////////////////////
async function getOdds(marketIds, sportsId) {
  // return new Promise(async (resolve, reject) => {
  //   const odds = [];
  //   const oddUrl = `http://84.8.153.51/api/v2/getMarketsOdds?EventTypeID=${sportsId}&marketId=${marketIds}`;
  //   const oddUrl2 = `http://sportzing.in:5505/api/getOdds?market_id=${marketIds}`;
  //   try {
  //     const response = await axios.get(oddUrl);

  //     console.log("================///============", response.data);

  //     if (response.data) {
  //       const oddData = response.data;
  //       // console.log("===================================================================================2");
  //       odds.push(await saveOdds(oddData, sportsId));
  //     }

  //     // Resolve the promise with the collected odds
  //     resolve(odds);

  //   } catch (error) {
  //     // res.status(500).json({ success: false, msg: "Failed to get odds from limitless. Error: " + error.message })
  //     // saving odds from lithyl API
  //     try {
  //       const response = await axios.get(oddUrl2);

  //       // console.log("================///============Odds from lithyl", JSON.stringify(response.data));

  //       if (response.data) {
  //         const oddData = response.data;
  //         odds.push(await saveOdds(oddData, sportsId));
  //       }

  //       // Resolve the promise with the collected odds
  //       resolve(odds);

  //     } catch (error2) {
  //       res.status(500).json({ success: false, msg: "Failed to get Odds from limitless. Error: " + error2.message })
  //     }
  //   }
  //   //   const response = await axios.get(oddUrl);

  //   //   console.log("================///============", response.data);

  //   // if (response.data) {
  //   //   const oddData = response.data;
  //   //   // console.log("===================================================================================2");
  //   //   odds.push(await saveOdds(oddData, sportsId));
  //   // }

  //   // // Resolve the promise with the collected odds
  //   // resolve(odds);
  // });
  try {
    // Make an Axios request to another API
    const dataToSend = {
      "matchId": "66e3147de0ccfa3f8d82e6b6",
      "subMarketName": "Match Odds",
      "betAmount": 100,
      "betRate": 5.2,
      "rates": [
          5.2
      ],
      "partnerValue": 5,
      "selectedAmount": 5.2,
      "type": 1,
      "selectedTime": "2024-09-15T14:20:46.625Z",
      "selectionId": 7157896,
      "sportsId": "4",
      "oddsId": "66e6ed3d58b00a283105c526",
      "fancyRate": 105.43,
      "timer": 2
  };
    const response = await axios.post('https://production.1obet.net/api/track-bet/lithylAPI/getHorseRaceMatches',dataToSend);

    // Send the data from the Axios request back to the client
    res.json(response.data);
  } catch (error) {
    // Handle errors
    console.error('Error making Axios request:', error);
    res.status(500).send('Internal Server Error');
  }
}

///////////////////////////////////////////////////////////////////////////////////////
async function cronOdds(req, res) {
  // console.log("===================================================================================3");
  const { eventId, sportID } = req.params;


  const url = `http://84.8.153.51/api/v2/getMarkets?EventTypeID=4&EventID=${eventId}`;


  try {
    const response = await axios.get(url);


    const marketsData = response.data;
    let marketStatus = 'OPEN';


    if (marketsData && marketsData?.length > 0) {
      let marketIds = [];
      let arrMarketIds = [];
      let cntrl = 0;
      marketsData.forEach((element) => {




        let tempRunners = [];
        let hasbetfairFancy = false;

        for (let k = 0; k < element?.runners?.length; k++) {
          tempRunners.push({
            SelectionId: element?.runners[k]?.selectionId,
            runnerName: element?.runners[k]?.runnerName
          });
        }






        if (element.marketName === 'Match Odds') {



          marketIds.push({
            id: element.marketId,
            marketName: element.marketName,
            sort: 1,
            openDate: Date.parse(element.marketStartTime),
            status: marketStatus,
            hasbetfairFancy: hasbetfairFancy,
            runners: tempRunners
          });
        }

        const marketID = MarketIDS.findOne({
          eventId: eventId,
          marketId: element.marketId
        });

        if (!marketID) {

          const newMarket = new MarketIDS({
            eventId: eventId,
            marketId: element.marketId,
            marketName: element.marketName,
            sportID: '4',
            totalMatched: element.totalMatched,
            status: marketStatus,
            index: 0,
            runners: tempRunners,
            inPlay: true
          });
          // console.log("nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn>>.", newMarket);
          const newmarket = newMarket.save();


        }

      });



    }



  } catch (error) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + error.message });
  }




  const sendMarketIds = [];
  for (let i = 0; i < pages; i++) {
    let matchId = [];
    if (i === 0) {
      matchId = matchIds.slice(0, i + 1 * count);
    } else {
      matchId = matchIds.slice(i * count, (i + 1) * count);
    }
    sendMarketIds.push(matchId.join(","));
  }





  let result = [];
  // console.log("sending market ids..............................................>", sendMarketIds);
  for (const marketIds of sendMarketIds) {
    // console.log("===================================================================================5");
    const odds = await getOdds(marketIds, sportID);
    result = [...result, ...odds];
  }
  res.json({ status: true, data: "here in res" + result });

}

// async function cronOdds2(req, res) {
//   // console.log("===================================================================================3");
//   const { eventId, sportID } = req.params;

//   // console.log ("+_+_+_++_+_++_+ SportsId +_+", sportID)

//   const url = `http://84.8.153.51/api/v2/getMarkets?EventTypeID=${sportID}&EventID=${eventId}`;
//   const bookmakerUrl = `http://sportzing.in:5505/api/getMarketList?match_id=${eventId}`;

//   try {
//     const response = await axios.get(url);
//     const bookmakerResponse = await axios.get(bookmakerUrl);

//     // console.log("=-=-==-=--=-=-=-=-=-=-=-  bookmakerResponse", bookmakerResponse.data);
//     const bookMakerData = bookmakerResponse.data;
//     const marketsData = response.data;
//     const sendMarketIds = [];
//     const bookmakerMarketIds = [];
//     // console.log(marketsData, "||||||||||||||||||||");
//     const marketStatus = 'OPEN';

//     // Handle Market Data
//     if (marketsData && marketsData.length > 0) {
//       for (const element of marketsData) {
//         const tempRunners = element.runners.map(runner => ({
//           SelectionId: runner.selectionId,
//           runnerName: runner.runnerName,
//         }));

//         if (element.marketName === 'Match Odds') {
//           sendMarketIds.push(element.marketId);

//           const marketID = await MarketIDS.findOne({
//             eventId: eventId,
//             marketId: element.marketId,
//           });

//           if (!marketID) {
//             const newMarket = new MarketIDS({
//               eventId: eventId,
//               marketId: element.marketId,
//               marketName: element.marketName,
//               sportID: sportID,
//               totalMatched: element.totalMatched,
//               openDate: Date.parse(element.marketStartTime),
//               status: marketStatus,
//               index: 0,
//               runners: tempRunners,
//               inPlay: true,
//             });

//             console.log("Saving new market: ", newMarket);
//             await newMarket.save();
//           } else {
//             console.log("{{}{}}{{}{}{}}} updating market id collec for match odds");
//             await MarketIDS.findOneAndUpdate(
//               { eventId: eventId, marketId: element.marketId },
//               { $set: { totalMatched: element.totalMatched } }
//             );
//           }
//         }
//       }
//     }

//     // Handle Bookmaker Data

//     if (bookMakerData && bookMakerData.length > 0) {
//       for (const element of bookMakerData) {
//         const bookmakerRunners = element.runners.map(runner => ({
//           SelectionId: runner.selectionId,
//           runnerName: runner.runnerName,
//         }));
//         console.log("element.marketName===[[[[[[[[[[[", element.marketName);

//         if (element.marketName ==="Match Odds"|| element.marketName === "To Win the Toss" || element.marketName === "Tied Match") {
//           sendMarketIds.push(element.marketId)
//           console.log("element.marketName===----", element.marketName);

//         }

//         bookmakerMarketIds.push(element.marketId);

//         const marketID = await MarketIDS.findOne({
//           eventId: eventId,
//           marketId: element.marketId,
//         });

//         if (!marketID) {
//           let marketTime = element.marketStartTime
//           if (!marketTime) {
//             marketTime = 0
//           } else {
//             marketTime = Date.parse(marketTime)
//           }
//           const newBookmakerMarket = new MarketIDS({
//             eventId: eventId,
//             marketId: element.marketId,
//             marketName: element.marketName,
//             sportID: sportID,
//             totalMatched: element.totalMatched,
//             openDate: marketTime,
//             status: marketStatus,
//             index: 0,
//             runners: bookmakerRunners,
//             inPlay: true,
//           });

//           console.log("Saving new bookmaker market: ", newBookmakerMarket);
//           await newBookmakerMarket.save();
//         }
//         // else {
//         //   console.log("Updating market id collection for bookmaker market");
//         //   await MarketIDS.findOneAndUpdate(
//         //     { eventId: eventId, marketId: element.marketId },
//         //     { $set: { totalMatched: element.totalMatched } }
//         //   );
//         // }
//       }
//     }

//     // Get odds for the standard markets
//     let result = [];
//     console.log("Sending market ids:", sendMarketIds);
//     for (const marketId of sendMarketIds) {
//       console.log("===================================================================================5");
//       const odds = await getOdds(marketId, sportID);
//       result = [...result, ...odds];
//     }

//     // Get odds for the bookmaker markets
//     // console.log("Sending bookmaker market ids:", bookmakerMarketIds);
//     // for (const marketId of bookmakerMarketIds) {
//     //   const bookmakerOdds = await getOdds(marketId, sportID);
//     //   result = [...result, ...bookmakerOdds];
//     // }

//     res.json({ status: true, data: "Result: ", result });

//   } catch (error) {
//     console.log({ msg: "Failed to get data. Error: " + error.message });
//   }
// }
////////////////// today end
async function cronOdds2(req, res) {
  // console.log("===================================================================================3");
  const { eventId, sportID } = req.params;

  // console.log ("+_+_+_++_+_++_+ SportsId +_+", sportID)
  if (sportID !== "4") {
    return res.status(401).send({ message: 'you can only fetch cricket Odds' });
  }
  const url = `http://84.8.153.51/api/v2/getMarkets?EventTypeID=${sportID}&EventID=${eventId}`;
  const url2 = `http://sportzing.in:5505/api/getMarketList?match_id=${eventId}`;
  try {
    const response = await axios.get(url);

    console.log("=-=--==---=-=--=-===--= market api response RRRRRRRRR", response.data);

    const marketsData = response.data;
    const sendMarketIds = [];
    // console.log(marketsData, "||||||||||||||||||||");
    const marketStatus = 'OPEN';

    if (marketsData && marketsData.length > 0) {
      for (const element of marketsData) {
        const tempRunners = element.runners.map(runner => ({
          SelectionId: runner.selectionId,
          runnerName: runner.runnerName,
        }));

        if (element.marketName === 'Match Odds') {

          sendMarketIds.push(element.marketId);

          const marketID = await MarketIDS.findOne({
            eventId: eventId,
            marketId: element.marketId,
          });

          if (!marketID) {
            const newMarket = new MarketIDS({
              eventId: eventId,
              marketId: element.marketId,
              marketName: element.marketName,
              sportID: '4',
              totalMatched: element.totalMatched,
              status: marketStatus,
              index: 0,
              runners: tempRunners,
              inPlay: true,
            });

            // console.log("Saving new market: ", newMarket);
            await newMarket.save();
          } else {
            await MarketIDS.findOneAndUpdate({ eventId: eventId, marketId: element.marketId, }, {
              $set: {
                totalMatched: element.totalMatched,
              }
            })
          }
        }
      }
    }


    // const sendMarketIds = ["1.232001727"];

    let result = [];
    // console.log(result,"=-=-=---=-=---=--=");

    console.log("Sending market ids:", sendMarketIds);
    for (const marketId of sendMarketIds) {
      // console.log("===================================================================================5");
      const odds = await getOdds(marketId, sportID);
      result = [...result, ...odds];
    }

    res.json({ status: true, data: "Result: ", result });

  } catch (error) {
    // res.status(500).json({ success: false, msg: "Failed to get data from limitless. Error: " + error.message });

    // fetch markets from lithyl API
    try {
      const response = await axios.get(url2);

      console.log("=-=--==---=-=--=-===--= market api response in sportsTest", response.data);

      const marketsData = response.data;
      const sendMarketIds = [];
      // console.log(marketsData, "||||||||||||||||||||");
      const marketStatus = 'OPEN';

      if (marketsData && marketsData.length > 0) {
        for (const element of marketsData) {
          const tempRunners = element.runners.map(runner => ({
            SelectionId: runner.selectionId,
            runnerName: runner.runnerName,
          }));

          if (element.marketName === 'Match Odds') {

            sendMarketIds.push(element.marketId);

            const marketID = await MarketIDS.findOne({
              eventId: eventId,
              marketId: element.marketId,
            });

            if (!marketID) {
              const newMarket = new MarketIDS({
                eventId: eventId,
                marketId: element.marketId,
                marketName: element.marketName,
                sportID: '4',
                totalMatched: element.totalMatched,
                status: marketStatus,
                index: 0,
                runners: tempRunners,
                inPlay: true,
              });

              // console.log("Saving new market: ", newMarket);
              await newMarket.save();
            } else {
              await MarketIDS.findOneAndUpdate({ eventId: eventId, marketId: element.marketId, }, {
                $set: {
                  totalMatched: element.totalMatched,
                }
              })
            }
          }
        }
      }


      // const sendMarketIds = ["1.232001727"];

      let result = [];
      // console.log(result,"=-=-=---=-=---=--=");

      console.log("Sending market ids:", sendMarketIds);
      for (const marketId of sendMarketIds) {
        // console.log("===================================================================================5");
        const odds = await getOdds(marketId, sportID);
        result = [...result, ...odds];
      }

      res.json({ status: true, data: "Result: ", result });

    } catch (error2) {
      res.status(500).json({ success: false, msg: "Failed to get data from lithyl. Error: " + error2.message });


    }
  }
}

async function getTheSportsMatchScoreEvents(req, res) {


  const { sportsId } = req.params;
  const inplays = await inPlayEvents.find({ sportsId });
  let sportsName = 'cricket';
  if (sportsId === '1') {
    sportsName = 'football';
  } else if (sportsId === '2') {
    sportsName = 'tennis';
  }
  const theSportsUrl = `https://api.thesports.com/v1/${sportsName}/match/diary?user=stepinn&secret=f365f74fbc01e6ecf55ba89bb725f504`;
  axios
    .get(theSportsUrl)
    .then(async ({ data }) => {
      const results = [];
      if (data?.results && data?.results?.length) {
        const newDatas = data.results.map((item) => {
          const home_team = data.results_extra.team.find((e) => e.id === item.home_team_id);
          item.home_team = home_team.name;
          const away_team = data.results_extra.team.find((e) => e.id === item.away_team_id);
          item.away_team = away_team.name;
          item.match_time = item.match_time * 1000;
          if (home_team.name && away_team.name) return item;
        });
        for (const newData of newDatas) {
          const data = inplays.filter((e) => (
            e.name.toLowerCase().includes(newData.home_team.toLowerCase()) ||
            e.name.toLowerCase().includes(newData.away_team.toLowerCase()) ||
            newData.home_team.toLowerCase().includes(e.name.split(' v ')[0]) ||
            newData.away_team.toLowerCase().includes(e.name.split(' v ')[1])
          ) && e.openDate === newData.match_time);
          if (data.length) {
            if (data.length === 1) {
              results.push({ ...data[0]._doc, theSports: newData });
            }
          }
        }
        //for (const item of results) {
        //await inPlayEvents.updateOne({ _id: item._id }, { theSportsId: item.theSports.id });
        //}
      }
      res.json({ status: true, data: { count: results.length, results } });
    })
    .catch((error) => {
      // console.log('error', error?.response?.data);
      res.status(500).json({ status: false, data: error?.response?.data });
    });



}




async function getMatchEvents(req, res) {
  const { sportsId } = req.params;
  const inplays = await inPlayEvents.find({ sportsId });
  let sportsName = 'cricket';
  if (sportsId === '1') {
    sportsName = 'football';
  } else if (sportsId === '2') {
    sportsName = 'tennis';
  }
  const theSportsUrl = `https://api.thesports.com/v1/${sportsName}/match/diary?user=stepinn&secret=f365f74fbc01e6ecf55ba89bb725f504`;
  axios
    .get(theSportsUrl)
    .then(async ({ data }) => {
      const results = [];
      if (data?.results && data?.results?.length) {
        const newDatas = data.results.map((item) => {
          const home_team = data.results_extra.team.find((e) => e.id === item.home_team_id);
          item.home_team = home_team.name;
          const away_team = data.results_extra.team.find((e) => e.id === item.away_team_id);
          item.away_team = away_team.name;
          item.match_time = item.match_time * 1000;
          if (home_team.name && away_team.name) return item;
        });
        for (const newData of newDatas) {
          const data = inplays.filter((e) => (
            e.name.toLowerCase().includes(newData.home_team.toLowerCase()) ||
            e.name.toLowerCase().includes(newData.away_team.toLowerCase()) ||
            newData.home_team.toLowerCase().includes(e.name.split(' v ')[0]) ||
            newData.away_team.toLowerCase().includes(e.name.split(' v ')[1])
          ) && e.openDate === newData.match_time);
          if (data.length) {
            if (data.length === 1) {
              results.push({ ...data[0]._doc, theSports: newData });
            }
          }
        }
        //for (const item of results) {
        //await inPlayEvents.updateOne({ _id: item._id }, { theSportsId: item.theSports.id });
        //}
      }
      res.json({ status: true, data: { count: results.length, results } });
    })
    .catch((error) => {
      console.log('error', error?.response?.data);
      res.status(500).json({ status: false, data: error?.response?.data });
    });
}


////////////////
async function updateUserBetSizesColec(req, res) {

  // const role = req.decoded.login.role
  // if (role != 0) {
  //   return res.send({
  //     message: 'you are not allowed to update bet sizes',
  //     success: true,

  //   });
  // }

  try {
    // await BetLimits.insertMany([{
    //   name: 'Over by Over',
    //   sportsId: '4',
    //   subarket: 70,
    //   maxAmount: 200000,
    //   ExpAmount: 200000,
    //   minAmount: 1000
    // },
    // {
    //   name: 'Betfair Fancy',
    //   sportsId: '4',
    //   subarket: 100,
    //   maxAmount: 200000,
    //   ExpAmount: 200000,
    //   minAmount: 1000
    // }])

    const userIds = await User.aggregate([
      {
        $group: {
          _id: "$userId",
        },
      },
      { $sort: { _id: 1 } },
    ])
    // console.log(userIds, "IIIIIIIIIIIIIIII");

    const userids = userIds.filter((data) => data._id !== null).sort().map((data) => data._id)
    // console.log(userids);

    let betLimits = await BetLimits.find({
      $or: [
        { name: "Betfair Fancy" },
        { name: "Over by Over" }
      ]
    });

    for (let i = 0; i <= userIds.length; i++) {

      let userId = userids[i]
      // let userId = 11001

      const userbetSizesData = betLimits.map((betLimit) => ({
        userId: userId,
        betLimitId: betLimit._id,
        amount: betLimit.maxAmount,
        name: betLimit.name,
        sportsId: betLimit.sportsId,
        subarket: betLimit.subarket,
        minAmount: betLimit.minAmount,
        ExpAmount: betLimit.ExpAmount
      }));

      // console.log(userbetSizesData);    
      //     await userBetSizes.deleteMany({ userId:userId });
      await userBetSizes.deleteMany({
        userId: userId,
        name: { $in: ["Betfair Fancy", "Over by Over"] }
      });

      await userBetSizes.insertMany(userbetSizesData);

    }

    return res.send({
      message: 'User Best Sizrs Updated Successfully',
      success: true,
      // results: userbetSizesData
    });

  } catch (error) {
    console.error("Error in updateUserBetSizesColec:", error);
    return res.status(500).send({
      message: 'An error occurred while updating user bet sizes',
      success: false,
      error: error.message,
    });

  }

}
///////////////
async function getRaceLatestRecord(req, res) {
  const { collectionName, marketId } = req.params;

  // console.log(`raceodds ------- ${collectionName}---------`);
  // console.log(`marketId ------- ${marketId}---------`);

  //  const marketId = req.query.marketId
  // raceodds

  try {
    if (collectionName == "odds") {
      const raceLatestRecord = await Odds.aggregate([
        {
          $match: { marketId: marketId }
        },
        { $sort: { createdAt: -1 } },
        { $limit: 1 }
      ])
      res.status(200).json({ success: true, message: 'Sports Latest Record from odds:', raceLatestRecord });
    }
    else {
      const raceLatestRecord = await RaceOdds.aggregate([
        {
          $match: { marketId: marketId }
        },
        { $sort: { createdAt: -1 } },
        { $limit: 1 }
      ])

      res.status(200).json({ success: true, message: 'Race Latest Record race odds:', raceLatestRecord });
    }

  } catch (error) {
    console.error("Error in updateUserBetSizesColec:", error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }

}


async function updateUserName(req, res) {
  // console.log("updating user name");
  try {
    const user = await Users.updateMany(
      {},
      [{ $set: { userName: { $toLower: "$userName" } } }]
    );

    res.status(200).json({
      success: true,
      message: 'User names updated successfully',
      user
    });
  } catch (error) {
    console.error("Error in update user name:", error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
async function testing(req, res) {
  try {
    const currentTime = Date.now();
    // const formattedTime = currentTime.toLocaleTimeString();
    // console.log(currentTime, "//////");


    res.status(200).json({
      success: true,
      message: 'User names updated successfully',

    });
  } catch (error) {
    console.error("Error in update user name:", error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/////////////MMMMMMMMMMM
async function getSeriesList(req, res) {
  const sportsId = req.params.sportsId;

  console.log("MMMMMMMMMMMMM sportsId--", sportsId);


  try {
    // const sportsAPIUrl = `http://sportzing.in:5505/api/getSeriesList?sport_id=${sportsId}`;
    const sportsAPIUrl = `http://sportzing.in:5505/api/getSeriesList?sport_id=${sportsId}`;
    const header = {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-App": process.env.XAPP_NAME,
        "Cache-Control": "no-cache"
      },
    };

    const response = await axios.get(sportsAPIUrl, header);
    console.log("MMMMMMMMMMMMMMMM--getSeriesList response ", response.data);

    // const marketsData = response.data;
    const getSeriesList = response.data;

    res.status(200).json({ success: true, data: getSeriesList });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + err.message });
  }
}
//////////////////////////
async function getAllMatchesList(req, res) {
  const series_id = req.params.series_id;

  console.log("MMMMMMMMMMMMM series_id--", series_id);


  try {
    const sportsAPIUrl = `http://sportzing.in:5505/api/getMatchesList?series_id=${series_id}`;
    const header = {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-App": process.env.XAPP_NAME,
        "Cache-Control": "no-cache"
      },
    };

    const response = await axios.get(sportsAPIUrl, header);
    console.log("MMMMMMMMMMMMMMMM--getAllMatchesList response ", response.data);

    // const marketsData = response.data;
    const getSeriesList = response.data;

    res.status(200).json({ success: true, data: getSeriesList });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + err.message });
  }
}
/////////
async function getAllMarketList(req, res) {
  const match_id = req.params.match_id;

  console.log("MMMMMMMMMMMMM match_id--", match_id);


  try {
    const sportsAPIUrl = `http://sportzing.in:5505/api/getMarketList?match_id=${match_id}`;
    const header = {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-App": process.env.XAPP_NAME,
        "Cache-Control": "no-cache"
      },
    };

    const response = await axios.get(sportsAPIUrl, header);
    console.log("MMMMMMMMMMMMMMMM--getAllMarketList response ", response.data);

    // const marketsData = response.data;
    const getAllMarketList = response.data;

    res.status(200).json({ success: true, data: getAllMarketList });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + err.message });
  }
}

//////////////
async function getOddsFancyBookmakerByMatchId(req, res) {
  const id = req.params.id;

  console.log("MMMMMMMMMMMMM id--", id);


  try {
    const sportsAPIUrl = `http://sportzing.in:5505/api/getOFBData?id=${id}`;
    console.log("------------------http://sportzing.in:5505/api/getOFBData?id=${id}")
    const header = {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-App": process.env.XAPP_NAME,
        "Cache-Control": "no-cache"
      },
    };


    const response = await axios.get(sportsAPIUrl, header);
    console.log("MMMMMMMMMMMMMMMM--getOddsFancyBookmakerByMatchId response ", response.data);

    // const marketsData = response.data;
    const getOddsFancyBookmakerByMatchId = response.data;

    res.status(200).json({ success: true, data: getOddsFancyBookmakerByMatchId });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + err.message });
  }
}
//////////////////// getGreyHoundMatches
async function getGreyHoundMatches(req, res) {
  ////////////////////////////
  // try {
  //   const sportsAPIUrl = `http://sportzing.in:5505/api/getGreyHoundMatches`;

  //   const header = {
  //     headers: {
  //       accept: "application/json",
  //       "Content-Type": "application/json",
  //       "X-App": process.env.XAPP_NAME,
  //       "Cache-Control": "no-cache"
  //     },
  //   };

  //   const response = await axios.get(sportsAPIUrl, header);

  //   const GreyHoundMatches = response.data;

  //   for (const match of GreyHoundMatches) {
  //     const eventDocument = {
  //       // sportsId: match.marketId,
  //       sport: match.marketName,
  //       Id: match.event.id,
  //       // competitionName: match.event.name,
  //       Id: match.event.id,
  //       name: match.event.name,
  //       countryCode: match.event.countryCode,
  //       timezone: match.event.timezone,
  //       openDate: new Date(match.event.openDate).getTime(),
  //       inplay: false,
  //       inplayFromServer: false,
  //       lastCheckMarket: 0,
  //       isShowed: false,
  //       status: "OPEN",
  //       marketIds: [match.marketId],
  //       type: 0,
  //       venue: match.event.venue,
  //       // countryCodes: match.event.countryCode,
  //       // meetingName: match.event.name,
  //       // meetingOpenDate: match.event.openDate
  //     };

  //     const savedEvent = await inPlayEventsLithylapi.create(eventDocument);
  //     console.log('Event saved successfully:', savedEvent);
  //   }

  //   res.status(200).json({ success: true, data: GreyHoundMatches });
  // } catch (err) {
  //   res.status(500).json({ success: false, msg: "Failed to get Error: " + err.message });
  // }
  ///////////////////////////
  try {
    const sportsAPIUrl = `http://sportzing.in:5505/api/getGreyHoundMatches`;

    const header = {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-App": process.env.XAPP_NAME,
        "Cache-Control": "no-cache"
      },
    };

    const response = await axios.get(sportsAPIUrl, header);

    //   const GreyHoundMatches = response.data;
    // const url = `${config.horseRaceUrl}/meetings/today/${sportsId}`;
    // const response = await axios.get(url);
    const meetings = response.data;
    let racesBulkOperation = [];
    let races = [];
    meetings.map((meeting) => {
      meeting.races.map((race) => {
        race.name = race.marketName;
        race.Id = race.raceId;
        race.marketIds = [race.marketId];
        race.openDate = Date.parse(race.startTime);
        race.meetingId = meeting.meetingId;
        race.meetingName = meeting.name;
        race.countryCode = meeting.countryCode;
        race.meetingOpenDate = meeting.openDate;
        race.venue = meeting.venue;
        race.meetingGoing = meeting.meetingGoing;
        race.sportsId = sportsId;
        races.push(race);
        racesBulkOperation.push({
          updateOne: {
            filter: { Id: race.Id },
            update: { $set: race },
            upsert: true,
          },
        });
      });
    });
    //console.log(races);
    const res = await Event.bulkWrite(racesBulkOperation);
    res.status(200).json({ success: true, data: meetings });
    // return ({
    //   success: true,
    //   message: 'Race Records list',
    //   results: races,
    //   eventIds:res?.result?.upserted
    // });
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: 'Failed to get or save inplay events',
      error: error.message,
    };
  }

}

async function getHorseRaceMatches(req, res) {

  try {
    // const sportsAPIUrl = `http://sportzing.in:5505/api/getGreyHoundMatches?id=${id}`;
    const sportsAPIUrl = `http://sportzing.in:5505/api/getHorseRaceMatches`;

    console.log("------------------http://sportzing.in:5505/api/getHorseRaceMatches")
    const header = {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-App": process.env.XAPP_NAME,
        "Cache-Control": "no-cache"
      },
    };


    const response = await axios.get(sportsAPIUrl, header);
    console.log("MMMMMMMMMMMMMMMM--getHorseRaceMatches response ", response.data);

    // const marketsData = response.data;
    const horseRaceMatches = response.data;
    res.status(200).json({ success: true, data: horseRaceMatches });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + err.message });
  }
}
//////////////////// getOdds
async function getOddsFromlithylAPI(req, res) {
  const market_id = req.params.market_id;

  console.log("MMMMMMMMMMMMM id--", market_id);

  try {
    // const sportsAPIUrl = `http://sportzing.in:5505/api/getGreyHoundMatches?id=${id}`;
    const sportsAPIUrl = `http://sportzing.in:5505/api/getOdds?market_id=${market_id}`;
    console.log("------------------http://sportzing.in:5505/api/getGreyHoundMatches")
    const header = {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-App": process.env.XAPP_NAME,
        "Cache-Control": "no-cache"
      },
    };


    const response = await axios.get(sportsAPIUrl, header);
    console.log("MMMMMMMMMMMMMMMM--getGreyHoundMatches response ", response.data);

    // const marketsData = response.data;
    const oddsData = response.data;

    res.status(200).json({ success: true, data: oddsData });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, msg: "Failed to get Error: " + err.message });
  }
}
////////////
function checkMultiResponse(rates, odds) {
  if (Array.isArray(rates) && Array.isArray(odds)) {
    const ratesSet = new Set(rates);
    let lowestMatch = null;

    for (const element of odds) {
      if (ratesSet.has(element)) {
        if (lowestMatch === null || element < lowestMatch) {
          lowestMatch = element;
        }
      }
    }

    return lowestMatch;
  }
}
//////////////////////////////////////////
async function updateOddsFormLimitless(req, res) {
  console.log("inside...................................................");

  try {
    const marketsData = await MarketIDS.find({ marketId: "1.232931464" });
    if (marketsData && marketsData.length > 0) {
      console.log('listMarketsByCronJobs is running ----------');

      for (let element of marketsData) {
        const time30Minutes = 30 * 60 * 1000;
        const currentTime = Date.now();
        const marketStartTime = element.openDate
        const remainingTime = marketStartTime - currentTime;

        if (remainingTime < time30Minutes) {
          const result = await MarketIDS.updateMany({ eventId: element.eventId, marketName: { $ne: "To Win the Toss" } }, { $set: { ReadyForOdds: true } });

          await MarketIDS.updateMany({ eventId: element.eventId, marketName: "To Win the Toss", ReadyForOdds: false }, { $set: { ReadyForOdds: false } });

        }

        if (remainingTime > time30Minutes) {
          const result = await MarketIDS.updateMany({ eventId: element.eventId, marketName: "To Win the Toss", ReadyForOdds: false }, { $set: { ReadyForOdds: true } });
          // const oddUrl = `http://84.8.153.51/api/v2/getMarketsOdds?EventTypeID=${element.sportID}&marketId=${element.marketId}`;
          const oddUrl = `http://sportzing.in:5505/api/getOdds?market_id=${element.marketId}`;

          const oddsResponse = await axios.get(oddUrl);

          if (oddsResponse) {
            let oddData = oddsResponse.data;
            // console.log("cron jobs response ======-----oddData ", oddData);
            const marketResp = await Odds.findOne({ marketId: oddData[0].marketId });

            console.log("response in cronjobs of odds----- ", marketResp);

            if (marketResp) {
              await Odds.findOneAndUpdate(
                { marketId: oddData[0].marketId },
                { $set: { totalMatched: oddData[0].totalMatched } }
              );
              console.log("odds updated in cronjobs for total matched----- TotalMatched=", oddData[0].totalMatched);
            }
          }
        }
      }
    }
    res.status(200).json({ success: true, message: "Total matched updated successfully" });
  } catch (error) {
    console.error("Error updating odds:", error);
  }
}
//////////////////////////////////////////

// //////////////////
router.get('/track-bet/lithylAPI/getSeriesList/:sportsId', getSeriesList)
router.get('/track-bet/lithylAPI/getAllMatchesList/:series_id', getAllMatchesList)
router.get('/track-bet/lithylAPI/getAllMarketList/:match_id', getAllMarketList)
router.get('/track-bet/lithylAPI/getOddsFancyBookmakerByMatchId/:id', getOddsFancyBookmakerByMatchId)
router.get('/track-bet/lithylAPI/getGreyHoundMatches', getGreyHoundMatches)
router.get('/track-bet/lithylAPI/getHorseRaceMatches', getOdds)
router.post('/track-bet/lithylAPI/getOdds', placeBet)
router.get('/track-bet/updateUserName', updateUserName)
router.get('/track-bet/updateOddsFormLimitless', updateOddsFormLimitless) ///// temp
router.get('/track-bet/multi-response', checkMultiResponse)
/////////////////

router.get('/updateUserBetSizesColec', updateUserBetSizesColec);/////// temprory route
router.get('/track-bet/get-latest-odds/:marketId/:collectionName', getRaceLatestRecord)
router.get('/testSports/events', listEvents)
router.get('/temp-work/closeopenmarkets', closeOpenMarkets)
router.get('/track-score/get-cricketscore', getCricketScore)
router.get('/testSports/events', listEvents);
router.get('/testSports/marketbooks/:ids', listMarketBook);
router.get('/trackstuck/activeusers', activeUserExposure);
router.get('/trackstuck/inactiveusers', inActiveUserExposure);
router.get('/trackstuck/deposits-casinocalls-deletion/:userId', deleteDepositsAndCasinoCalls);
router.get('/track-bet/bet-statistic/:userId', betStatisticsByUserId)

router.get('/track-bet/testAPI/:marketId', testAPI)
router.get('/track-bet/get-markets/:eventId', getMarketsByEventId)
router.get('/track-bet/get-events/:sportsId', getEventsBySportsId)
router.get('/track-bet/get-today-events/:sportsId', getTodayEventsBySportsId)
router.get('/track-bet/get-odds/:marketId', getOddsByMarketId)
router.get('/track-bet/get-odds2/:marketId', getOddsByMarketId2)
router.get('/track-bet/get-odds-multi-marketids/:eventId', getOddsByMultiMarketId)
router.get('/track-bet/get-markettype', getMarketType)
router.get('/track-bet/get-market-by-type/:eventId/:marketTypes?', getMarketsByMarketType)
router.get('/track-bet/get-market-bet-session/:eventId', getFanciesByEventId)

router.get('/track-bet/get-markets-limitless/:eventId', getMarketsLimitlessByEventId)
router.get('/track-bet/get-markets-limitless2/:eventId', getMarketsLimitlessByEventId2)
router.get('/track-bet/get-bookmakers-limitless/:eventId', getBookmakersLimitlessByEventId)
router.get('/track-bet/get-odds-limitless/:marketId', getOddsLimitlessByMarketId)
router.get('/track-bet/get-score-limitless/:eventId', getScoreLimitlessByEventId)
router.get('/track-bet/check-market/:sportID/:eventId', cronOdds)
router.get('/track-bet/check-market2/:sportID/:eventId', cronOdds2)
router.get('/track-bet/delete-odds/:eventId', deleteOdds)
router.get('/track-bet/get-relatedmarkets/:marketId/:sportid', getRelatedMarkets)
router.get('/track-bet/test-trial/:eventId', TestTrial)
router.get('/match-events/:sportsId', getMatchEvents)
router.get('/match-events-details/:sportsId', getTheSportsMatchScoreEvents)
// router.get('/test-odds-for-cricket/:eventId', )
/*admin dashboard*/
router.get('/admin-dashboard/fetch-events/:sportsId', fetchEvents)

router.post('/list-events', getEventList)

module.exports = { router, listEvents, listMarketBook, activeUserExposure, inActiveUserExposure, getCricketScore };
