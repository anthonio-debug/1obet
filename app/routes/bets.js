const express = require('express');
var jwt = require('jsonwebtoken');
const userValidation = require('../validators/user');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
let config = require('config');
const Bets = require('../models/bets');
const User = require('../models/user');
const CricketMatch = require('../models/cricketMatches');
const Markets = require('../models/marketTypes');
const SubMarketType = require('../models/subMarketTypes');
const loginRouter = express.Router();
const betValidator = require('../validators/bets');
const maxAllowedBetSizes = require('../models/betLimits');
const userBetSizes = require('../models/userBetSizes');
const betRates = require('../models/betRate');
const MarketType = require('../models/marketTypes');
const Odds = require('../models/odds');
const Events = require('../models/events');
const FancyGames = require('../models/fancyGames');
const RaceOdds = require('../models/raceOdds');
const RaceMarkets = require('../models/raceMarkets');
const axios = require('axios')
const ListMarkets = require('../models/listMarkets')
const currentPosition = require('../models/CurrentPosition');
const FancyOdds = require('../models/fancyOdds');
const Session   = require('../models/Session');
const { log } = require('async');
const Cash = require("../../app/models/deposits");
const mongoose = require('mongoose');


const getParents = async (userId) => {
  const parentUserIds = [];
  let currentUserId = userId;
  console.log('currentUserId', currentUserId);

  while (currentUserId) {
    const parentUser = await User.findOne({ userId: currentUserId });

    if (!parentUser || !parentUser.createdBy || parentUser.createdBy == currentUserId) {
      break;
    }
    parentUserIds.push(parentUser.createdBy);
    currentUserId = parentUser.createdBy;
  }
  console.log(" parentUserIds ========== ", parentUserIds);
  return parentUserIds;
}

const updateParentUserBalance = async (parentUsersIds, winningAmount, matchId = 0, Id = 0) => {
  const parentUser = await User.find({
    userId: {
      $in: [...parentUsersIds],
    },
    isDeleted: false,
  }).sort({ role: -1 });


  let prev = 0;
  parentUser.forEach((user) => {
    let current = user.downLineShare;
    let commission = current - prev;
    user["commission"] = commission;
    prev = current;
  });
  for (const user of parentUser) {
    console.log(`user id ${user.userId} =====`, user.commission);
    user.exposure -= (user.commission / 100) * winningAmount;
    user.availableBalance -= (user.commission / 100) * winningAmount;
    await user.save();
    console.log("Saving parent users");
    if (matchId != 0) {
      // console.log("inside of current position" );
      // const position = new currentPosition({
      //   userId: user.userId,
      //   amount: - (user.commission / 100) * winningAmount,
      //   matchId: matchId,
      // })
      // position.save();

      let position = await new currentPosition({
        userId: user.userId,
        description: "some transection name",
        amount: -(user.commission / 100) * winningAmount,
        betId: Id,
        matchId: matchId,
      });
      await position.save();

    }
  }

};

const placeBet = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length != 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  try {
    console.log("req.decoded.login.role", req.decoded.login);
    if (req.decoded.login.role != '5') {
      return res.status(401).send({ message: 'You are not allowed to bet' });
    }
    let runnerName;
    let currentSession;
    let subMarketDetail;
    let marketId;
    let selectedOddsRate;
    const { selectionId, betAmount, betRate, matchId, subMarketName, type, oddsId } = req.body;
    const userId = req.decoded.userId;
    let ApiResponseOdds;
    let matchedIndex;
    let winningAmount = 0;
    let loosingAmount = 0;
    let isFancyOrBookMaker = false;
    let _3rdPartyMarketId = 0
    let TargetScore = 0;

    if (betAmount < config.betMinimumAmount) {
      return res.status(404).send({ message: `minimum bet should be ${config.betMinimumAmount}` });
    }
    const user = await User.findOne({ userId }).exec();
    if (!user) {
      return res.status(404).send({ message: 'illegal user betting' });
    }
    console.log('userAvailableBalance', user.availableBalance)
    if ((user.availableBalance < betAmount && type == 0) || (user.availableBalance < betAmount * (betRate - 1) && type == 1)) {
      return res.status(404).send({ message: 'Insufficient balance' });
    }
    if (user.bettingAllowed == false) {
      return res.status(404).send({ message: 'Bet not allowed' });
    }
    let parentUserIds = await getParents(user.userId);
    const marketIds = await User.distinct("blockedMarketPlaces", { userId: { $in: parentUserIds }, isDeleted: false });
    const subMarketId1 = await User.distinct("blockedSubMarkets", { userId: { $in: parentUserIds }, isDeleted: false });
    const subMarketId2 = await User.distinct("blockedSubMarketsByParent", { userId: { $in: parentUserIds }, isDeleted: false });
    const subMarketId = subMarketId1.concat(subMarketId2);
    const eventDetail = await Events.findById(matchId);

    if (!eventDetail) {
      return res.status(404).send({ message: 'EVENT COULD NOT FOUND' });
    }
    marketId = eventDetail?.sportsId;
    console.log(" marketId ======== ", marketId);
    let id;

    // Checks for Market Places & Sub Markets  
    if (config.raceMarkets.includes(marketId)) {

      const requiredTime = new Date().getTime() + config.raceOpenBefore;
      const remainingTimeFromEvent = eventDetail.openDate - requiredTime
      if (remainingTimeFromEvent > 0) {
        return res.status(404).send({
          status: true,
          message: `Bets will Allow in : ${Math.ceil(remainingTimeFromEvent / 60000)} min`
        })
      }

      id = eventDetail.marketIds[0];
      _3rdPartyMarketId = id
      subMarketDetail = await SubMarketType.findOne({ countryCode: subMarketName, marketId: marketId }).exec();
      if (!subMarketDetail) {
        return res.status(404).send({ message: 'Bet not allowed' });
      }
    } else {
      const requiredTime = new Date().getTime() + config.sportsOpenBefore;
      const remainingTimeFromEvent = eventDetail.openDate - requiredTime
      if (marketId != config.Toss && remainingTimeFromEvent > 0) {
        return res.status(404).send({
          status: true,
          message: `Bets will Allow in : ${Math.ceil(remainingTimeFromEvent / 60000)} min`
        })
      }

      const currentMarket = eventDetail?.marketIds?.find((market) => market.marketName == subMarketName);
      id = currentMarket?.id;
      _3rdPartyMarketId = id
      subMarketDetail = await SubMarketType.findOne({ name: subMarketName, marketId: marketId }).exec();

      if (!subMarketDetail) {
        return res.status(404).send({ message: 'you cannot place bet' });
      }
    }

    if (marketIds.includes(marketId) || subMarketId.includes(subMarketDetail.Id) || user.betLockStatus == true || user.blockedSubMarketsByParent.includes(subMarketDetail.Id)) {
      return res.status(404).send({ message: 'Betting disabled' });
    }
    const userMaxBetSize = await userBetSizes.findOne({ userId: userId, sportsId: marketId }).exec();
    if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
      return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
    }

    // cricket tennis soccer odds only match odds 
    if (config.sportMarkets.includes(marketId) && config.SportOddsSubMarkets.includes(subMarketDetail.Id)) {
      const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
      const response = await axios.get(url);
      const oddsData = response.data;
      if (!oddsData) {
        console.log(`Match odds not found for sports ID ${sportsId}`);
        return res.status(404).send({ message: `Bet mis match` });
      }
      console.log('data from  API', oddsData);
      const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
      testRunner = runnerFromAPI

      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      console.log("DBOddDetails === ", DBOddDetails);
      if (type == 0) {
        ApiResponseOdds = runnerFromAPI.ExchangePrices.AvailableToBack
        const OddDetailsTeam = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
        const availableToBack = OddDetailsTeam.ExchangePrices.AvailableToBack;
        console.log('availableToBack', availableToBack);
        matchedIndex = availableToBack.findIndex((back) => {
          return back.price == betRate;
        });
        console.log('matchedIndex', matchedIndex);
        if (matchedIndex == -1) {
          console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
          return res.status(404).send({ message: `No availableToBack odds matched with the bet rate ${req.body.betRate}` });
        }
        selectedOddsRate = availableToBack[matchedIndex].price;

      } else if (type == 1) {
        ApiResponseOdds = runnerFromAPI.ExchangePrices.AvailableToLay
        const OddDetailsTeam = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
        const AvailableToLay = OddDetailsTeam.ExchangePrices.AvailableToLay;
        console.log('AvailableToLay', AvailableToLay);
        matchedIndex = AvailableToLay.findIndex((back) => {
          return back.price === betRate;
        });
        console.log('matchedIndex', matchedIndex);
        if (matchedIndex == -1) {
          console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
          return res.status(404).send({ message: `Bet miss matched` });
        }
        selectedOddsRate = AvailableToLay[matchedIndex].price;

      } else {
        console.log('Invalid type value. Type should be 0 or 1.');
        return res.status(400).send({ message: 'Bet miss matched' });
      }
      if (!selectedOddsRate) {
        console.log('Selected odds not found for the bet');
        return res.status(404).send({ message: 'Bet miss Matched' });
      }

      // console.log(`ApiResponseOdds at ${matchedIndex}`, ApiResponseOdds[matchedIndex]);

      if (ApiResponseOdds[matchedIndex].price < betRate) {
        return res.status(404).send({ message: `Bet miss matched` });
      }
    }

    // HR GH odds market 
    else if (config.raceMarkets.includes(marketId)) {

      console.log("MarketId ========== ", id);
      const url = `${config.horseRaceUrl}/odds/?ids=${id}`;
      const response = await axios.get(url);
      const oddsData = response.data;

      console.log("odds Data Runners ====== ", oddsData);
      if (oddsData.length == 0) {
        console.log(`Match odds not found for sports ID`);
        return res.status(404).send({ message: `Bet mis match` });
      }

      console.log('data =========== ', oddsData[0]?.runners);
      console.log('selectionId ========= ', selectionId);

      const runnerFromAPI = oddsData[0].runners.find((runner) => {
        return runner.selectionId == selectionId
      });
      // 
      testRunner = runnerFromAPI
      console.log('match odds runners ====== ', runnerFromAPI);

      if (type == 0) {
        ApiResponseOdds = runnerFromAPI?.exchange?.availableToBack
        console.log("ApiResponseOdds AvailableToBack === ", ApiResponseOdds);

        const DBOddDetails = await RaceOdds.findById(oddsId);
        console.log("DBOddDetails === ", DBOddDetails);
        const OddDetailsTeam = DBOddDetails.runners.find((runner) => {
          return runner.selectionId == selectionId
        });
        const availableToBack = OddDetailsTeam.exchange.availableToBack;
        // console.log('availableToBack', availableToBack);
        matchedIndex = availableToBack.findIndex((back) => {
          return back.price == betRate;
        });
        console.log('matchedIndex', matchedIndex);
        if (matchedIndex == -1) {
          console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
          return res.status(404).send({ message: `No availableToBack odds matched with the bet rate ${betRate}` });
        }
        selectedOddsRate = availableToBack[matchedIndex].price;

      } else if (type == 1) {
        ApiResponseOdds = runnerFromAPI.exchange.availableToLay
        console.log("ApiResponseOdds AvailableToLay ====== ", ApiResponseOdds);
        const DBOddDetails = await RaceOdds.findById(oddsId);
        const OddDetailsTeam = DBOddDetails.runners.find(runner => runner.selectionId == selectionId);

        const AvailableToLay = OddDetailsTeam.exchange.availableToLay;
        console.log(" AvailableToLay new Server Test  ======= ", AvailableToLay);
        matchedIndex = AvailableToLay.findIndex((back) => {
          return back.price == betRate;
        });
        console.log('matchedIndex', matchedIndex);
        if (!matchedIndex == -1) {
          console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
          return res.status(404).send({ message: `Bet miss matched` });
        }
        selectedOddsRate = AvailableToLay[matchedIndex].price;

      } else {
        console.log('Invalid type value. Type should be 0 or 1.');
        return res.status(400).send({ message: 'Bet miss matched' });
      }
      if (!selectedOddsRate) {
        console.log('Selected odds not found for the bet');
        return res.status(404).send({ message: 'Bet miss Matched' });
      }

      if (ApiResponseOdds[matchedIndex].price < betRate) {
        return res.status(404).send({ message: `Bet miss matched` });
      }
    }

    //for fancy
    else if (subMarketDetail.Id == config.Fancy) {
      isFancyOrBookMaker = true;
      const eventId = eventDetail.Id
      const url = `${config.fancyUrl}/bm_fancy/${eventId}`;
      const response = await axios.get(url);
      const apiFancyOdds = response?.data?.data?.t3;
      const DBOddDetails = await FancyOdds.findById(oddsId);
      const dbFancyOdds = DBOddDetails?.data?.data?.t3

      console.log(" apiFancyOdds ====== ", apiFancyOdds);
      console.log(" dbFancyOdds  ====== ", dbFancyOdds);

      if (apiFancyOdds?.length && dbFancyOdds?.length) {

        const apiSelectedOdds = apiFancyOdds.find(runner => runner.sid == req.body.selectionId);
        const dbSelectedOdds = dbFancyOdds.find(runner => runner.sid == req.body.selectionId);

        if (!apiSelectedOdds || !dbSelectedOdds) {
          console.log(" apiSelectedOdds ====== ", apiSelectedOdds);
          console.log(" dbSelectedOdds ====== ", dbSelectedOdds);

          console.log(`Odds not available for the selected team ${req.body.selectionId}`);
          return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
        }
        runnerName = dbSelectedOdds.nat; // Get the runner name from the 'nat' field

        if (req.body.type == 0) {

          const apiBackOdds2 = [apiSelectedOdds.bs1, apiSelectedOdds.bs2, apiSelectedOdds.bs3];
          const apiBackOdds = apiBackOdds2.map(item => Number(item))

          const DbBackOdds2 = [dbSelectedOdds.bs1, dbSelectedOdds.bs2, dbSelectedOdds.bs3];
          const DbBackOdds = DbBackOdds2.map(item => Number(item))

          const DbBackScores2 = [dbSelectedOdds.b1, dbSelectedOdds.b2, dbSelectedOdds.b3];
          const DbBackScores = DbBackScores2.map(item => Number(item))

          console.log(" DbBackOdds ============ ", DbBackOdds);

          const index = DbBackOdds.indexOf(betRate)
          TargetScore = DbBackScores[index]

          if (index == -1) {
            console.log(`index ================== ${index}`);
            console.log(`betRate ==================  ${betRate}`);
            return res.status(404).send({ message: `Index miss matched` });
          }
          if (apiBackOdds[index] < betRate) {
            console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
            return res.status(404).send({ message: `Bet miss matched ` });
          }
        }
        else if (req.body.type == 1) {
          const apiBackOdds2 = [apiSelectedOdds.ls1, apiSelectedOdds.ls2, apiSelectedOdds.ls3];
          const apiBackOdds = apiBackOdds2.map(item => Number(item));

          const DbBackOdds2 = [dbSelectedOdds.ls1, dbSelectedOdds.ls2, dbSelectedOdds.ls3];
          const DbBackOdds = DbBackOdds2.map(item => Number(item));

          const DbBackScores2 = [dbSelectedOdds.l1, dbSelectedOdds.l2, dbSelectedOdds.l3];
          const DbBackScores = DbBackScores2.map(item => Number(item));

          console.log(" DbBackOdds ============ ", DbBackOdds);

          const index = DbBackOdds.indexOf(betRate);
          TargetScore = DbBackScores[index];

          if (index == -1) {
            console.log(` 1 index ================== ${index}`);
            console.log(` 1 betRate ==================  ${betRate}`);
            return res.status(404).send({ message: `Index miss matched` });
          }
          if (apiBackOdds[index] < betRate) {
            console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
            return res.status(404).send({ message: `Bet miss matched` });
          }
        }
        else {
          console.log('Invalid type value. Type should be 0 or 1.');
          return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
        }
      }
      else {
        console.log(`Odds not available for the selected team ${req.body.selectionId}`);
        return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
      }

    }

    // for bookmaker
    else if (subMarketDetail.Id == config.BookMaker) {
      isFancyOrBookMaker = true;
      const eventId = eventDetail.Id
      const url = `${config.fancyUrl}/bm_fancy/${eventId}`;
      console.log(" url ===== ", url);
      const response = await axios.get(url);
      console.log("bookmaker response ========", response.data);

      if (!response?.data?.data?.t2?.length) {
        console.log(`Odds not available for the selected team ||||||  ${req.body.selectionId}`);
        return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
      }
      const apiFancyOdds = response?.data?.data?.t2?.length ? response?.data?.data?.t2[0]?.bm1 : [];
      const DBOddDetails = await FancyOdds.findById(oddsId);
      const dbFancyOdds  = DBOddDetails?.data?.data?.t2[0]?.bm1

      console.log(" apiFancyOdds ==== ", apiFancyOdds)
      console.log(" dbFancyOdds ==== ", dbFancyOdds)

      if (apiFancyOdds.length && dbFancyOdds.length) {
        const apiSelectedOdds = apiFancyOdds.find(runner => runner.sid == req.body.selectionId);
        const dbSelectedOdds = dbFancyOdds.find(runner => runner.sid == req.body.selectionId);

        if (!apiSelectedOdds || !dbSelectedOdds) {
          console.log(`Odds not available for the selected team ${req.body.selectionId}`);
          return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
        }
        runnerName = null;
        if (req.body.type == 0) {
          const apiBackOdds2 = [apiSelectedOdds.b1, apiSelectedOdds.b2, apiSelectedOdds.b3];
          const apiBackOdds = apiBackOdds2.map(item => Number(item));

          const DbBackOdds2 = [dbSelectedOdds.b1, dbSelectedOdds.b2, dbSelectedOdds.b3];
          const DbBackOdds = DbBackOdds2.map(item => Number(item));

          const DbBackScores2 = [dbSelectedOdds.bs1, dbSelectedOdds.bs2, dbSelectedOdds.bs3];
          const DbBackScores = DbBackScores2.map(item => Number(item));

          const index = DbBackOdds.indexOf(betRate)
          TargetScore = DbBackScores[index]
          if (index == -1) {
            console.log(" index apiBackOdds ==== ", apiBackOdds);
            console.log(" index index ==== ", index);
            console.log(`Index didn't Match ${betRate}`);
            return res.status(404).send({ message: `Index didn't Match` });
          }
          if (apiBackOdds[index] < betRate) {
            console.log(" 2 apiBackOdds ==== ", apiBackOdds);
            console.log(" 2 index ==== ", index);

            console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
            return res.status(404).send({ message: `Bet miss matched` });
          }
        }
        else if (req.body.type == 1) {
          const apiBackOdds2 = [apiSelectedOdds.l1, apiSelectedOdds.l2, apiSelectedOdds.l3];
          const apiBackOdds = apiBackOdds2.map(item => Number(item));

          const DbBackOdds2 = [dbSelectedOdds.l1, dbSelectedOdds.l2, dbSelectedOdds.l3];
          const DbBackOdds = DbBackOdds2.map(item => Number(item));


          const DbBackScores2 = [dbSelectedOdds.ls1, dbSelectedOdds.ls2, dbSelectedOdds.ls3];
          const DbBackScores = DbBackScores2.map(item => Number(item));

          const index = DbBackOdds.indexOf(betRate)
          TargetScore = DbBackScores[index]

          if (index == -1) {
            console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
            return res.status(404).send({ message: `Index miss matched` });
          }
          if (apiBackOdds[index] < betRate) {
            console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
            return res.status(404).send({ message: `Bet miss matched` });
          }
        }
        else {
          console.log('Invalid type value. Type should be 0 or 1.');
          return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
        }
      }
    }

    // Figure Even Odd & Small Big
    else if (config.FigureEvenOddSmallBig.includes(subMarketDetail.Id)) {
      let score = await cricketLiveScore(eventDetail.Id);
      console.log(" Score ======================= ", score)
      if (!score) {
        return res.json({
          status: false,
          message: `Bet Not Allowed : ${score}`
        });
      }
      console.log(' only  score |||| ====== |||| ', score);
      let currentOver = score.overs;
      let inning = score.inning;
      let totalSessions = 0
      if (currentOver % 5 == 0) currentOver += 1
      let currentSessionOver = Math.ceil(currentOver % 5);
      let currentSession = Math.ceil(currentOver / 5);
      console.log(" currentSession = ", currentSession, " currentSessionOver =", currentSessionOver, " currentOver =", currentOver);

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
          currentSession = Math.ceil(currentOver / 10);
          break;
        default:
          return res.json(404, {
            success: false,
            message: `Match Type is not defined : ${eventDetail.matchType}`,
          });
          break;
      }

      if (inning == 2 && currentSession == totalSessions) {
        return res.status(404).send({
          success: false,
          message: 'betting not Allowed in last Session',
          currentSession: currentSession,
          totalSessions: totalSessions,
          currentSessionOver: currentSessionOver,
        });
      }
      else if (currentSessionOver > 3) {
        return res.status(404).send({
          success: false,
          message: `betting not Allowed in ${Math.ceil(currentOver % 5)} over`,
          currentSession: currentSession,
          totalSessions: totalSessions,
          over: currentOver
        })

      }
      console.log("Bets are Allowed");
      console.log(" currentSession ========= ", currentSession);
    }
    else {
      return res.status(404).send({ message: `Error Placing bet (Inappropriate Request)` });
    }

    if (config.FigureEvenOddSmallBig.includes(subMarketDetail.Id)) {
      winningAmount = betAmount;
      loosingAmount = betAmount;
    }
    else if (type == 2) {
      winningAmount = (betAmount * betRate) - betAmount;
      loosingAmount = betAmount;
    }

    else if (type == 0) {
      winningAmount = (betAmount * betRate) - betAmount;
      loosingAmount = betAmount;
    }

    else if (type == 1) {
      winningAmount = betAmount;
      loosingAmount = (betAmount * betRate) - betAmount;
    }

    const bet = new Bets({
      marketId: _3rdPartyMarketId,
      sportsId: marketId,
      userId,
      betAmount,
      betRate: betRate,
      TargetScore: TargetScore,
      matchId: matchId,
      loosingAmount: loosingAmount,
      winningAmount: winningAmount,
      subMarketId: subMarketDetail.Id,
      betSession: currentSession ? currentSession : null,
      runner: selectionId ? selectionId : '',
      type: type,
      event: eventDetail.name,
      isfancyOrbookmaker: isFancyOrBookMaker,
      fancyData: runnerName ? runnerName : null,
      createdAt: new Date().getTime(),
    });

    bet.save(async (err, result) => {
      if (err) {
        console.log('err', err);
        return res.status(404).send({ message: `Error placing bet ${err}` });
      }
      try {
        const position = new currentPosition({
          userId: userId,
          amount: - loosingAmount,
          matchId: matchId,
        })
        position.save();

        const updatedUser = await User.findOneAndUpdate(
          { userId: userId },
          {
            $inc: {
              availableBalance: -loosingAmount,
              exposure: -loosingAmount
            },
          },
        );
        // console.log("parentUserIds ===========", parentUserIds);
        // console.log("winningAmount ===========", winningAmount);
        // console.log("matchId =================", matchId);

        await updateParentUserBalance(parentUserIds, winningAmount, matchId);

        return res.send({
          success: true,
          message: 'Bet placed successfully',
          results: result,
        });
      }
      catch (error) {
        console.error('error', error);
        return res.status(404).send({ message: 'Error updating user balance' });
      }
    });

  } catch (error) {
    console.error('error', error);
    return res.status(404).send({ message: `Error placing bet ${error}` });
  }
}

async function getUserBets(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length != 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  // to be remove for initial state 
  // ================================
  console.log("==========", req.body.userId);
  const bets = await Bets.find({ userId: req.body.userId });
  return res.send({
    success: true,
    message: 'bets record found',
    results: bets,
  });

  // =============================

  // Initialize variables with default values
  let query = {};
  let page = 1;
  let sort = -1;
  let sortValue = 'createdAt';
  var limit = config.pageSize;
  if (req.body.numRecords) {
    if (isNaN(req.body.numRecords))
      return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.body.numRecords < 0)
      return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.body.numRecords > 100)
      return res.status(404).send({
        message: 'NUMBER_RECORDS_NEED_TO_LESS_THAN_100',
      });
    limit = Number(req.body.numRecords);
  }
  if (req.body.sortValue) sortValue = req.body.sortValue;
  if (req.body.sort) sort = Number(req.body.sort);
  if (req.body.page) page = Number(req.body.page);
  if (req.body.startDate && req.body.endDate) {
    const startTimestamp = new Date(req.body.startDate).getTime() / 1000;
    const endTimestamp = new Date(req.body.endDate).getTime() / 1000;
    query.createdAt = {
      $gte: startTimestamp,
      $lte: endTimestamp,
    };
  }

  if (req.decoded.role != '5') query.userId = req.body.userId;
  else if (req.decoded.role == '5') query.userId = req.decoded.userId;

  if (req.body.status) query.status = req.body.status;
  if (req.body.marketId) query.marketId = req.body.marketId;
  // if (req.body.searchValue) {
  //   const searchRegex = new RegExp(req.body.searchValue, 'i');
  //   query.$or = [
  //     { name: { $regex: searchRegex } },
  //     {
  //       $expr: {
  //         $regexMatch: { input: { $toString: '$betRate' }, regex: searchRegex },
  //       },
  //     },
  //     {
  //       $expr: {
  //         $regexMatch: {
  //           input: { $toString: '$betAmount' },
  //           regex: searchRegex,
  //         },
  //       },
  //     },
  //   ];
  // }

  User.findOne({ userId: req.decoded.userId }, (err, user) => {
    if (err || !user) {
      return res.status(404).send({ message: 'User not found' });
    }
    Bets.paginate(
      query,
      { page: page, sort: { [sortValue]: sort }, limit: limit },
      (err, result) => {
        if (err || !result)
          return res.status(404).send({ message: 'bets not found' });
        return res.send({
          success: true,
          message: 'bets record found',
          results: result,
        });
      }
    );
  });
}

function betFunds(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.array() });
  }

  if (req.decoded.role !== '5') {
    User.find({ createdBy: req.decoded.userId, role: '5' }, (err, users) => {
      if (err || !users) {
        return res.status(404).send({ message: 'Error occurred while querying users.' });
      }

      const userIds = users.map(user => user.userId);

      Bets.find({ userId: { $in: userIds } }, (err, bets) => {
        if (err || !bets) {
          return res.status(404).send({ message: 'Error occurred in bets.' });
        }

        const activeBets = bets.filter(bet => bet.status === 1).length;

        User.findOne({ userId: req.decoded.userId }, (err, user) => {
          if (err || !user) {
            return res.status(404).send({ message: 'User Not Found' });
          }

          const results = {
            balance: user.balance,
            liable: user.exposure,
            credit: user.credit,
            available: user.availableBalance,
            activeBets: activeBets,
          };

          return res.send({ message: 'Funds Record Found', results: results });
        });
      });
    });
  } else {
    Bets.find({ userId: req.decoded.userId }, (err, bets) => {
      if (err) {
        return res.status(404).send({ message: 'Error occurred in bets.' });
      }

      User.findOne({ userId: req.decoded.userId }, (err, user) => {
        if (err || !user) {
          return res.send({ message: 'User Not Found' });
        }

        const activeBets = bets.filter(bet => bet.status === 1).length;

        const results = {
          balance: user.balance,
          liable: user.exposure,
          credit: user.credit,
          available: user.availableBalance,
          activeBets: activeBets,
        };

        return res.send({ message: 'Funds Record Found', results: results });
      });
    });
  }
}

function createBetRates(req, res) {
  const recordsToCreate = 15;
  const AllbetRates = [];
  let betRate = 1.5;
  for (let i = 0; i < recordsToCreate; i++) {
    const roundedBetRate = Number(betRate.toFixed(1));
    AllbetRates.push(roundedBetRate);
    betRate += 0.2;
  }
  const betRatesData = [
    {
      match: "PAK vs AUS",
      teams: [
        {
          name: "Pakistan",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name: "AUS",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name: "draw",
          back: AllbetRates,
          lay: AllbetRates
        },
      ]
    },
    {
      match: "PAK vs IND",
      teams: [
        {
          name: "Pakistan",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name: "IND",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name: "draw",
          back: AllbetRates,
          lay: AllbetRates
        },
      ]
    },
    {
      match: "IND vs AUS",
      teams: [
        {
          name: "IND",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name: "AUS",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name: "draw",
          back: AllbetRates,
          lay: AllbetRates
        },
      ]
    },
  ];
  betRates.insertMany(betRatesData)
    .then(() => {
      res.status(200).json({ message: 'Dummy data created successfully.' });
    })
    .catch((error) => {
      res.status(500).json({ error: 'Error creating dummy data.' });
    });
}

async function getBetRates(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const matchId = req.params.id;
  const match = await betRates.findOne({ _id: matchId });
  if (!match) {
    return res.status(404).send({ message: 'bets rate not found' });
  }

  const randomRates = getRandomRates(match);

  return res.send({
    success: true,
    message: 'bets rate records',
    results: randomRates,
  });
}

function getRandomRates(match) {
  const randomRates = [];

  for (const team of match.teams) {
    const randomBackRates = getRandomSubset(team.back, 3);
    const randomLayRates = getRandomSubset(team.lay, 3);

    randomRates.push({
      name: team.name,
      back: randomBackRates,
      lay: randomLayRates,
    });
  }


  return {
    match: match.match,
    teams: randomRates
  }
}

function getRandomSubset(arr, size) {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}

async function getAllUserIDs(createdByIDs, processedIDs = new Set()) {
  const userIDs = [];

  if (createdByIDs.length === 0) {
    return userIDs;
  }

  console.log('Created By:', createdByIDs);

  const uniqueIDs = createdByIDs.filter(id => !processedIDs.has(id));
  processedIDs = new Set([...processedIDs, ...uniqueIDs]);

  const users = await User.find({ createdBy: { $in: uniqueIDs } }, { userId: 1, userName: 1, createdBy: 1 }).lean();

  for (const user of users) {
    userIDs.push(user.userId);
  }

  console.log('Sub-users fetched for Created By:', createdByIDs);

  const subUserIDs = await getAllUserIDs(userIDs, processedIDs);
  userIDs.push(...subUserIDs);

  return userIDs;
}

async function getMatchedBets(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.array() });
  }

  try {
    const loginUser = await User.findOne({ userId: req.decoded.userId });
    if (!loginUser) {
      return res.status(404).send({ message: 'User not found' });
    }

    const bettorMaster = await User.findOne({ userId: loginUser.createdBy });
    const userOfLoginUser = await User.find({ createdBy: loginUser.userId });
    const createdByIDs = userOfLoginUser.map(user => user.userId);

    // Fetch all user IDs using optimized function
    const userIDs = await getAllUserIDs(createdByIDs);



    const matchId = req.query.id

    if (loginUser.role == '5') {
      userIDs.push(loginUser.userId);
    }

    // Use the $lookup aggregation pipeline to fetch matched bets along with user information and related events
    var matchedBets = await Bets.aggregate([
      { $match: { userId: { $in: [...createdByIDs, ...userIDs, loginUser.userId] }, status: 1, matchId: matchId } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: 'userId',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      {
        $lookup: {
          from: 'users',
          localField: 'userDetails.createdBy',
          foreignField: 'userId',
          as: 'masterDetails'
        }
      },
      {
        $lookup: {
          from: 'inplayevents',
          localField: 'sportsId',
          foreignField: 'sportsId',
          as: 'eventDetails'
        }
      },
      {
        $project: {
          _id: 0,
          price: '$betRate',
          runnerId: '$runnerName',
          createdAt: '$createdAt',
          size: '$betAmount',
          runner: '$runner',
          marketId: '$marketId',
          betRate: '$betRate',
          type: '$type',
          isfancyOrbookmaker: '$isfancyOrbookmaker',
          fancyData: '$fancyData',
          bettor: '$userDetails.userName',
          bettorId: '$userDetails.userId',
          master: {
            $cond: [
              { $eq: [loginUser.role, '5'] },
              loginUser.userName,
              { $ifNull: [{ $arrayElemAt: ['$masterDetails.userName', 0] }, ''] }
            ]
          },
          event: {
            $cond: [
              { $eq: [loginUser.role, '5'] },
              {
                $map: {
                  input: { $slice: ['$eventDetails', 5] },
                  as: 'event',
                  in: {
                    name: '$$event.name',
                    openDate: '$$event.openDate'
                  }
                }
              },
              '$$REMOVE'
            ]
          },
        }
      }
    ]).exec();


    if (!matchedBets || matchedBets.length === 0) {
      return res.status(200).send({ message: 'Matched bets not found', data: [] });
    }

    const eventId = await Events.findById(matchId);
    const relatedEvents = await Events.find({
      sportId: eventId.sportId,
      openDate: {
        $gt: eventId.openDate
      }
    }).limit(5)

    if (matchedBets.length > 0) {
      const promises = matchedBets.map(async item => {
        const multiplier =  await getPercentageSharing(item.bettorId, loginUser.userId );
        return {
          ...item,
          percentage: multiplier
        };
      });
      matchedBets = await Promise.all(promises);

    }


    return res.send({
      success: true,
      message: 'Matched bets record found',
      data: matchedBets,
      events: relatedEvents
    });
  } catch (err) {
    console.error('Aggregation error:', err);
    return res.status(500).send({ message: 'Error retrieving matched bets', error: err });
  }
}

async function FakeBetsList(req, res) {
  try {
    Bets.find(
      { isFake: 1 },
      (err, result) => {
        if (err || !result) {
          return res.status(404).send({ message: 'bets rate not found' });
        }
        return res.send({
          success: true,
          message: 'Bets List',
          results: result,
        });
      }
    );
  } catch (error) {
    return res.send({
      success: false,
      message: 'Some thing went wrong',
      results: error,
    });
  }
}

async function updateFakeBet(req, res) {
  try {
    const betId = req.params.id;
    const updateBet = await Bets.findOneAndUpdate(
      { _id: betId },
      {
        $set: {
          isFake: 0,
        }
      }
    );

    if (!updateBet) {
      return res.status(404).json({ message: 'Bet not found' });
    }

    return res.status(200).send({ message: 'Bet successfully updated', success: true });

  } catch (error) {
    return res.send({
      success: false,
      message: 'Some thing went wrong',
      results: error,
    });
  }
}

async function deleteFakeBet(req, res) {
  try {
    const betId = req.params.id;
    const deletedBet = await Bets.findByIdAndDelete(betId);
    if (!deletedBet) {
      return res.status(404).json({ message: 'Bet not found' });
    }

    return res.status(200).send({ message: 'Bet deleted successfully', success: true });

  } catch (error) {
    return res.send({
      success: false,
      message: 'Some thing went wrong',
      results: error,
    });
  }
}

async function countFakeBet(req, res) {
  try {
    const fakeCount = await Bets.countDocuments(
      { isFake: 1 }
    );

    return res.send({
      success: false,
      message: 'Some thing went wrong',
      results: {
        totalFakeBets: fakeCount
      },
    });
  } catch (error) {
    return res.send({
      success: false,
      message: 'Some thing went wrong',
      results: error,
    });
  }
}

async function approvedFakeBet(req, res) {
  if (req.decoded.role !== '0') {
    return res.status(403).send({ message: 'Only company can perform this operation' });
  }

  try {
    const betId = req.params.id;
    const fakeBet = await Bets.findOne({ _id: betId, isFake: 1 });

    if (!fakeBet) {
      return res.status(404).json({ message: 'Bet not found' });
    }
    const updatedUser = await User.findOneAndUpdate(
      { userId: fakeBet.userId },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).send({ message: 'user deactivated successfully', success: true });

  } catch (error) {
    console.error('Error updating bet:', error);
    return res.status(500).send({
      success: false,
      message: 'Something went wrong',
      error: error.message
    });
  }
}

async function reviewFakeBet(req, res) {
  if (req.decoded.role !== '0') {
    return res.status(403).send({ message: 'Only company can perform this operation' });
  }

  try {
    const betId = req.params.id;
    const sportsId = req.params.sportsId;

    const fakeBet = await Bets.findOne({ _id: betId, isFake: 1, sportsId: sportsId });

    if (!fakeBet) {
      return res.status(404).json({ message: 'Bet not found' });
    }

    // Find the odds before the bet's createdAt timestamp
    const oddsBeforeBet = await Odds.find({
      eventId: fakeBet.eventId,
      createdAt: { $lt: fakeBet.createdAt },
    }).sort({ createdAt: -1 }).limit(200).select('eventId updatetime runners');

    // Find the odds after the bet's createdAt timestamp
    const oddsAfterBet = await Odds.find({
      eventId: fakeBet.eventId,
      createdAt: { $gt: fakeBet.createdAt },
    }).sort({ createdAt: 1 }).limit(200).select('eventId updatetime runners');

    // Combine the runners into a single array for both oddsBeforeBet and oddsAfterBet
    const BeforeBetOdds = oddsBeforeBet.map((odds) => odds.runners).flat();
    const AfterBetOdds = oddsAfterBet.map((odds) => odds.runners).flat();

    return res.status(200).send({
      message: 'Odds successfully retrieved',
      success: true,
      eventId: fakeBet.eventId,
      updatetime: fakeBet.createdAt,
      BeforeBetOdds,
      AfterBetOdds,
    });

  } catch (error) {
    console.error('Error retrieving odds:', error);
    return res.status(500).send({
      success: false,
      message: 'Something went wrong',
      error: error.message,
    });
  }
}

async function cricketLiveScore(id) {
  try {
    const event = await Events.findOne({ Id: id }, { _id: 0, matchType: 1, sportsId: 1 });
    const type = event ? event.sportsId : null;
    console.log("event", event);

    if (type == "4") {
      const apiResponse = await axios.get(`${config.sportsLiveScore}${id}`);
      const response = {};
      const data = apiResponse.data;
      if (data[0]?.score != null) {
        const event = await Events.findOne({ Id: id }, { _id: 0, matchType: 1, sportsId: 1 });
        const type = event ? event?.matchType : null;
        // const scoreInfo     = JSON.parse(data).score
        const scoreInfo = data[0].score

        let score = 0;
        let inning = 1;
        if (scoreInfo.activenation1 == 1) {
          score = scoreInfo.score1;
          played = scoreInfo.score2;
        }
        else if (scoreInfo.activenation2 == 1) {
          score = scoreInfo.score2;
          played = scoreInfo.score1;
        }
        if (type == "TEST") {
          score = score.split('&');
          score = score[score.length - 1].trim()
          played = played.split('&');
          played = played[played.length - 1].trim();
        }

        played = played?.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
        played = played.filter(element => element != 0).length;
        if (played > 0) {
          inning = 2;
        }

        [response.score, response.wickets, response.overs] = score?.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
        response.inning = inning;
        response.balls  = scoreInfo.balls;
        return response
      }else {
        return 0
      }
    } else {
      return {
        status: false,
        message: "Figure batting not Allowed !"
      }
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

const sessionCalc = async  (req, res) => {
  try {
    const eventsIds = await Events.distinct("Id", { sportsId: "4", inplay: true, status: { $in:['OPEN', 'open'  ] }});
    // console.log('eventsIds ===== ', eventsIds);
    // const  eventsIds = [ 1809020000 ]
    console.log(" events Ids ==================== ", eventsIds);

    for (let Id of eventsIds){
      console.log(" ===================== ", Id);

      const event = await Events.find({ Id: Id }, { _id: 0, matchType: 1, sportsId: 1 });

      console.log(" event ===================== ", event);

      const type  = event.matchType;
      console.log(" type ========== ", type);

      if(!config.matchTypes.includes(type)){
        console.log(" Returnning due to invalid  ========== ", type);
        // return `Type of Match is Not Applicable ${type}`
      }

      const score           = await cricketLiveScore(Id);

      console.log("score ============= ", score);

      // console.log(' only  score  ===================== ', score );

      const currentScore    = Number(score.score)

      const sessionLength   = type == "TEST" ? 10 : 5;

      config.balls.includes(score.balls[5]) ? currentScore = currentScore - Number(score.balls[0]) : ''
        let currentOver = score.overs;
        let ball        = currentOver.split('.')[1]
        let inning      = score.inning;  

        console.log("ball   ===================== ", ball);
        console.log("inning ===================== ", inning);


        if(currentOver % sessionLength < 1  && ball == 1){

          console.log(" conditional ball  ===================== ", ball)
          console.log(" conditional over ===================== ", score.overs % sessionLength);

          let sessionToResult      = Math.floor(currentOver/sessionLength);

          console.log(" session To Result ======= ", sessionToResult);

          const update = await  Session.findOneAndUpdate({ 
              eventId: Id,
              sessionNo: sessionToResult 
            },
            {
              $set: {
                score: currentScore
              } 
          });
          console.log(`Score Successfully Added to Session # ${sessionToResult} Event Id : ${Id}`); 
        }
        else {
          console.log(`Session Not Applicable`);
        } 
    }
  } catch (error) {
      console.error('Error running odds cron job:', error);
  }
};

async function getPercentageSharing(parent_id, child_id) {
  let currentId = child_id;
  let parent = null;

  if (parent_id == child_id)
  return 1;

  while (true) {
    parent = await User.findOne({ userId: currentId });
    if (!parent || parent.createdBy === null || parent.createdBy === undefined ) {
      return 1;
    } else if (parent.userId == parent_id){
      return parent.downLineShare;
    }
    currentId = parent.createdBy;
  }
}

const postmanwork = async (req, res)=>{
  try{
    const deposits  = await Cash.find({ cashOrCredit: {
      $in: ["Bet", "Commission", "loosing"] 
    } });
    console.log(" deposits  ================= ", deposits.length);

    for (let i = 0; i < deposits.length; i++) {
      console.log(" deposits ================= ", deposits[i]);
      const bet = await Bets.findOne({ _id: mongoose.Types.ObjectId(deposits[i].betId) });
      console.log(" ================= ", bet);
      if(bet){
        await Cash.updateOne(
          { _id: deposits[i]._id },
          { $set: { sportsId: bet.sportsId } }
        );
      }
    }
    return res.send({
      message: "Completed !"
    })

  }
  catch (err){
    return res.send({
      message: `Error ${err} !`
    })
  }
}

loginRouter.post('/placeBet', betValidator.validate('placeBet'), placeBet);
loginRouter.post('/getUserBets', getUserBets);
loginRouter.get('/betFunds', betFunds);
loginRouter.post('/createBetRates', createBetRates);
loginRouter.get('/getBetRates/:id', getBetRates);
loginRouter.get('/getMatchedBets', getMatchedBets);
loginRouter.get('/FakeBetsList', FakeBetsList);
loginRouter.delete('/deleteFakeBet/:id', deleteFakeBet);
loginRouter.put('/updateFakeBet/:id', updateFakeBet);
loginRouter.get('/countFakeBets', countFakeBet);
loginRouter.post('/approvedFakeBet/:id', approvedFakeBet);
loginRouter.get('/reviewFakeBet/:id/:sportsId', reviewFakeBet);
// loginRouter.get('/sessionCalc', sessionCalc);
loginRouter.get('/postmanwork', postmanwork);


module.exports = { sessionCalc,  loginRouter, getParents };
