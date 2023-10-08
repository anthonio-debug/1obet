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
const handleLimitValue = async (selectedRate, marketId)=>{
  if(selectedRate?.toString()?.split('.')?.length ==1 && selectedRate >= 30) return 6;
  else if(selectedRate?.toString()?.split('.')?.length == 1 && selectedRate >= 20) return 3;
  else if (selectedRate >= 10) return 1.5; 
  else if(selectedRate >= 6) return .60;
  else if (selectedRate >= 4)  return .30;
  else if (selectedRate >= 3) return .15;
  else if(selectedRate >= 2) return .06;
  else if(selectedRate >= 1)return .03 ;
}

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

const updateParentUserBalance = async (parentUsersIds, winningAmount, matchId = 0, Id = 0, selectionId=0, marketId = "") => {
  const parentUser = await User.find({
    userId: {
      $in: [...parentUsersIds],
    },
    isDeleted: false,
  }).sort({ userId: -1 });
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
      let position = await new currentPosition({
        userId: user.userId,
        description: "some transection name",
        amount: -(user.commission / 100) * winningAmount,
        betId: Id,
        matchsId: matchId,
        share : user.commission
      });
      await position.save();

    }
  }

}

const placeBet = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length != 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    if (req.decoded.login.role != '5') {
      return res.status(401).send({ message: 'You are not allowed to bet' });
    }
    /* =============================  Base Settings   ============================== */ 
    let runnerName;
    let currentSession;
    let subMarketDetail;
    let marketId;
    let selectedOddsRate;
    let { selectionId, betAmount, betRate, matchId, subMarketName, type, oddsId, fancyRate, overunderMarketId, selectedAmount } = req.body;
    const selectedBetRate = selectedAmount
    const userId = req.decoded.userId;
    let ApiResponseOdds;
    let matchedIndex;
    let winningAmount = 0;
    let loosingAmount = 0;
    let isFancyOrBookMaker = false;
    let _3rdPartyMarketId = 0
    let TargetScore = 0;
    let fancyData = null;
    let runnerForSaveInbets = null;
    let expoisureType = 1;
    const multipeResponse = [];
    const multipeResponseForSecurityCheck = [];
    const BetTime = new Date().getTime();
    let id = 0;
    let isManuel = true;

    /* ====================================================================== */ 


    /* ============================== Innitial Checks  ============================== */ 
    if (betAmount < config.betMinimumAmount) {
      return res.status(404).send({ message: `minimum bet should be ${config.betMinimumAmount}` });
    }
    const user = await User.findOne({ userId }).exec();
    if (!user) {
      return res.status(404).send({ message: 'illegal user betting' });
    }
	
    if (user.bettingAllowed == false) {
      return res.status(404).send({ message: 'Bet not allowed' });
    }
    let parentUserIds   = await getParents(user.userId);
    const marketIds     = await User.distinct("blockedMarketPlaces", { userId: { $in: parentUserIds }, isDeleted: false });
    const subMarketId1  = await User.distinct("blockedSubMarkets", { userId: { $in: parentUserIds }, isDeleted: false });
    const subMarketId2  = await User.distinct("blockedSubMarketsByParent", { userId: { $in: parentUserIds }, isDeleted: false });
    const subMarketId   = subMarketId1.concat(subMarketId2);
    const eventDetail   = await Events.findById(matchId);

    if (!eventDetail) {
      return res.status(404).send({ message: 'EVENT COULD NOT FOUND' });
    }
    if(!eventDetail.betAllowed){
      return res.status(404).send({ message: 'Batting Not Allowd on this Match' });      
    }
    if(eventDetail.status.toUpperCase() != "OPEN"){
      return res.status(404).send({ message: 'Batting Not Allowd on this Match' });      
    }

    marketId = eventDetail?.sportsId;
    const Digitaddition = await handleLimitValue(betRate, marketId);
    console.log(" marketId ======== ", marketId);
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
    } 
    else {
      const requiredTime = new Date().getTime() + config.sportsOpenBefore;
      const remainingTimeFromEvent = eventDetail.openDate - requiredTime
      let thirdPartyMarketName = subMarketName
      if(subMarketName == "Toss"){
        thirdPartyMarketName = "To Win the Toss"
      }
      const currentMarket = eventDetail?.marketIds?.find((market) => market.marketName == thirdPartyMarketName);
      id = currentMarket?.id;
      _3rdPartyMarketId = id
      subMarketDetail = await SubMarketType.findOne({ name: subMarketName, marketId: marketId }).exec();

      if (!subMarketDetail) {
        return res.status(404).send({ message: 'you cannot place bet' });
      }
      console.log( " ================= subMarketDetail.Id ", subMarketDetail );
      if (subMarketDetail.Id != config.Toss && remainingTimeFromEvent > 0) {
        return res.status(404).send({
          status: true,
          message: `Bets will Allow in : ${Math.ceil(remainingTimeFromEvent / 60000)} min`
        })
      }
    }

    console.log(" ================== top id ================== ", id);

    console.log(" ================== subMarketDetail ================== ", subMarketDetail);

    if (marketIds.includes(marketId) || subMarketId.includes(subMarketDetail.Id) || user.betLockStatus == true || user.blockedSubMarketsByParent.includes(subMarketDetail.Id)) {
      return res.status(404).send({ message: 'Betting disabled' });
    }
    const userMaxBetSize = await userBetSizes.findOne({ userId: userId, sportsId: marketId });

    if(!userMaxBetSize){
      return res.status(404).send({ message: `something went wrong !` });
    }

    if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
      return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
    }
    /* ==================================================================== */ 

    /* ================================== Market Specific Checks ================================== */ 

    // Socer Match Odds 
    if (config.sportMarkets.includes(marketId) && config.soccerOdds == subMarketDetail.Id) {
      console.log(" ======================== Soccer  Match Odds ======================== ");
      const DBOddDetails  = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets  = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
      runnerName = OddDetailsTeam?.runnerName
      console.log(" ============================ ========================== ", runnerForSaveInbets);

      if(selectedBetRate == betRate){
        for (let i = 1; i < 5; i++) {
          setTimeout( async () => {
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            let selectedOddsValue   = 0;
            if (type == 0) {
              const ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToBack;
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0].price
              }
              if(selectedOddsValue != 0 && betRate <= selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);

            } 
            else if (type == 1) {
              const ApiResponseOdds = runnerFromAPI.ExchangePrices?.AvailableToLay
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0]?.price
              }
              if(selectedOddsValue != 0 && betRate >=  selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } 
          }, 1000 * i);
        }
      }
      else if (type == 1 && betRate > selectedBetRate &&  betRate-Digitaddition > selectedBetRate){
        console.log(" type == 1 && betRate > selectedBetRate &&  betRate-Digitaddition > selectedBetRate Value Not found In this Array ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }
      else if (type == 0 && selectedBetRate < betRate &&  selectedBetRate - Digitaddition > betRate){
        console.log(" type == 0 && selectedBetRate > betRate &&  selectedBetRate - Digitaddition > betRate Value Not found In this Array ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }
      else if (type == 1 && betRate < selectedBetRate){
        console.log(" ===== type == 1 && betRate < selectedBetRate ===== ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }
      else if (type == 0 && betRate > selectedBetRate){
        console.log(" ===== type == 0 && betRate > selectedBetRate ===== ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }
      else if (type == 1 &&  selectedBetRate != betRate){
        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToLay;
            console.log(" ================ ApiResponseOdds ================ ", ApiResponseOdds);
            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue <= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
        }
      }
      else if (type == 0 &&  selectedBetRate != betRate){
        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToBack;
            console.log(" ================ ApiResponseOdds ================ ", ApiResponseOdds);
            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue >= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
        }
      }
    }

    // Tennis Match Odds 
    else if (config.sportMarkets.includes(marketId) && config.tennisOdds == subMarketDetail.Id) {
      console.log(" ======================== Tennis Match Odds ======================== ");
      const DBOddDetails  = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets  = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
      runnerName = OddDetailsTeam?.runnerName
      console.log(" ============================ ========================== ", runnerForSaveInbets);

      if(selectedBetRate == betRate){
        for (let i = 1; i < 5; i++) {
          setTimeout( async () => {
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            let selectedOddsValue   = 0;
            if (type == 0) {
              const ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToBack;
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0].price
              }
              if(selectedOddsValue != 0 && betRate <= selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);

            } 
            else if (type == 1) {
              const ApiResponseOdds = runnerFromAPI.ExchangePrices?.AvailableToLay
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0]?.price
              }
              if(selectedOddsValue != 0 && betRate >=  selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } 
          }, 1000 * i);
        }
      }
      else if (type == 1 && betRate > selectedBetRate &&  betRate-Digitaddition > selectedBetRate){
        console.log(" type == 1 && betRate > selectedBetRate &&  betRate-Digitaddition > selectedBetRate Value Not found In this Array ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }
      else if (type == 0 && selectedBetRate < betRate &&  selectedBetRate - Digitaddition > betRate){
        console.log(" type == 0 && selectedBetRate > betRate &&  selectedBetRate - Digitaddition > betRate Value Not found In this Array ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if (type == 1 && betRate < selectedBetRate){
        console.log(" type == 1 && betRate < selectedBetRate ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }
      else if (type == 0 && betRate > selectedBetRate){
        console.log(" type == 1 && betRate < selectedBetRate ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if (type == 1 &&  selectedBetRate != betRate){
        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToLay;
            console.log(" ================ ApiResponseOdds ================ ", ApiResponseOdds);
            /**
             * 
             * selectedRate 30
             * Bet Rate 29
             * 
             */
            
            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue <= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
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

      }

      else if (type == 0 &&  selectedBetRate != betRate){


        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            // console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToBack;
            // console.log(" ================ ApiResponseOdds ================ ", ApiResponseOdds);
            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue >= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
        }
      }
    }

    // Cricket Match Odds 
    else if (config.sportMarkets.includes(marketId) && config.cricketOdds == subMarketDetail.Id){
      console.log(" ======================== Soccer  Match Odds ======================== ");

      const DBOddDetails  = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets  = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
      runnerName = OddDetailsTeam?.runnerName
      console.log(" ============================ ========================== ", runnerForSaveInbets);

      if(selectedBetRate == betRate){
        for (let i = 1; i < 5; i++) {
          setTimeout( async () => {
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            let selectedOddsValue   = 0;
            if (type == 0) {
              const ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToBack;
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0].price
              }
              if(selectedOddsValue != 0 && betRate <= selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);

            } 
            else if (type == 1) {
              const ApiResponseOdds = runnerFromAPI.ExchangePrices?.AvailableToLay
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0]?.price
              }
              if(selectedOddsValue != 0 && betRate >=  selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } 
          }, 1000 * i);
        }
      }
      else if (type == 1 && betRate < selectedBetRate){
        console.log(" type == 1 && betRate < selectedBetRate ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }
      else if (type == 0 && betRate > selectedBetRate){
        console.log(" type == 1 && betRate < selectedBetRate ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if (type == 1 &&  selectedBetRate != betRate){
        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToLay;
            console.log(" ================ ApiResponseOdds ================ ", ApiResponseOdds);
            /**
             * 
             * selectedRate 30
             * Bet Rate 29
             * 
             */
            
            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue <= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
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

      }

      else if (type == 0 &&  selectedBetRate != betRate){


        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToBack;
            console.log(" ================ ApiResponseOdds ================ ", ApiResponseOdds);
            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue >= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
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

    // GH HR match odds 
    else if (config.raceMarkets.includes(marketId)) {
      runnerName = req.body.runnerName
      console.log(" ============================ GH & HR ============================ ");
      const DBOddDetails = await RaceOdds.findById(oddsId);
      const OddDetailsTeam = DBOddDetails.runners.find(runner => runner.selectionId == selectionId);
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets  = runners.map((runner) => ({
        runner: runner.selectionId,
        amount: 0
      }));

      if(selectedBetRate == betRate){
        for (let i = 1; i < 5; i++) {
          setTimeout( async () => {
            const url = `${config.horseRaceUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            const runnerFromAPI = oddsData[0]?.runners.find(runner => runner.selectionId == selectionId);
            console.log(" =================== runnerFromAPI ====================== ", runnerFromAPI);
            let selectedOddsValue   = 0;
            if (type == 0) {
              const ApiResponseOdds = runnerFromAPI?.exchange?.availableToBack;
              console.log(" ========================== ApiResponseOdds ========================== ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0].price
              }
              if(selectedOddsValue != 0 && betRate <= selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } else if (type == 1) {
              const ApiResponseOdds = runnerFromAPI.exchange?.availableToLay
              console.log(" ========================== ApiResponseOdds ========================== ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0].price
              }
              if(selectedOddsValue != 0 && betRate >=  selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } 
          }, 1000 * i);
        }
      }
      else if (type == 1 && betRate > selectedBetRate &&  betRate-Digitaddition > selectedBetRate){
        console.log(" type == 1 && betRate > selectedBetRate &&  betRate-Digitaddition > selectedBetRate Value Not found In this Array ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }
      else if (type == 0 && selectedBetRate < betRate &&  selectedBetRate - Digitaddition > betRate){
        console.log(" type == 0 && selectedBetRate > betRate &&  selectedBetRate - Digitaddition > betRate Value Not found In this Array ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if (type == 1 && betRate < selectedBetRate){
        console.log(" type == 1 && betRate < selectedBetRate ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if (type == 0 && betRate > selectedBetRate){
        console.log(" type == 1 && betRate < selectedBetRate ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if (type == 1 &&  selectedBetRate != betRate){
        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      

            const url = `${config.horseRaceUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log( " =================== oddsData =============== ", oddsData );
            
            const runnerFromAPI = oddsData[0]?.runners.find(runner => runner.selectionId == selectionId);
            console.log( " =================== runnerFromAPI =============== ", runnerFromAPI );

            const ApiResponseOdds = runnerFromAPI?.exchange?.availableToLay;
            console.log( " =================== ApiResponseOdds =============== ", ApiResponseOdds );

            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue <= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
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

      }

      else if (type == 0 &&  selectedBetRate != betRate){
        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      
            const url = `${config.horseRaceUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log( " =================== oddsData =============== ", oddsData );
            const runnerFromAPI = oddsData[0]?.runners.find(runner => runner.selectionId == selectionId);
            console.log( " =================== runnerFromAPI =============== ", runnerFromAPI );

            const ApiResponseOdds = runnerFromAPI?.exchange?.availableToBack;
            console.log( " =================== runnerFromAPI =============== ", runnerFromAPI );

            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue >= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
        }
      }
    }

    // soccer over under 
    else if (config.sportMarkets.includes(marketId) && subMarketDetail.Id == config.overUnder){
      _3rdPartyMarketId = overunderMarketId
      console.log(" ======================== Soccer over under  ======================== ");
      const DBOddDetails  = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets  = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
      runnerName = OddDetailsTeam?.runnerName
      console.log(" ============================ ========================== ", runnerForSaveInbets);
      console.log(" ========================================== id ========================================== ", id);
      if(selectedBetRate == betRate){
        for (let i = 1; i < 5; i++) {
          setTimeout( async () => {
            const url = `${config.sportsAPIUrl}/odds/?ids=${overunderMarketId}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            let selectedOddsValue   = 0;
            if (type == 0) {
              const ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToBack;
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0].price
              }
              if(selectedOddsValue != 0 && betRate <= selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);

            } 
            else if (type == 1) {
              const ApiResponseOdds = runnerFromAPI.ExchangePrices?.AvailableToLay
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0]?.price
              }
              if(selectedOddsValue != 0 && betRate >=  selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } 
          }, 1000 * i);
        }
      }

      else if (type == 1 && betRate > selectedBetRate &&  betRate-Digitaddition > selectedBetRate){
        console.log(" type == 1 && betRate > selectedBetRate &&  betRate-Digitaddition > selectedBetRate Value Not found In this Array ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if (type == 0 && selectedBetRate < betRate &&  selectedBetRate - Digitaddition > betRate){
        console.log(" type == 0 && selectedBetRate > betRate &&  selectedBetRate - Digitaddition > betRate Value Not found In this Array ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if (type == 1 && betRate < selectedBetRate){
        console.log(" type == 1 && betRate < selectedBetRate ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if (type == 0 && betRate > selectedBetRate){
        console.log(" type == 1 && betRate < selectedBetRate ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if (type == 1 &&  selectedBetRate != betRate){
        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      
            const url = `${config.sportsAPIUrl}/odds/?ids=${overunderMarketId}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToLay;
            console.log(" ================ ApiResponseOdds ================ ", ApiResponseOdds);
            /**
             * 
             * selectedRate 30
             * Bet Rate 29
             * 
             */
            
            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue <= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
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

      }

      else if (type == 0 &&  selectedBetRate != betRate){


        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      
            const url = `${config.sportsAPIUrl}/odds/?ids=${overunderMarketId}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToBack;
            console.log(" ================ ApiResponseOdds ================ ", ApiResponseOdds);
            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue >= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
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

    // cricket Tied Match 
    else if ( config.sportMarkets.includes(marketId) && subMarketDetail.Id == config.tiedMatch ) {
      console.log(" ======================== Soccer  Match Odds ======================== ");

      const DBOddDetails  = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets  = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
      runnerName = OddDetailsTeam?.runnerName
      console.log(" ============================ ========================== ", runnerForSaveInbets);

      if(selectedBetRate == betRate){
        for (let i = 1; i < 5; i++) {
          setTimeout( async () => {
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            let selectedOddsValue   = 0;
            if (type == 0) {
              const ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToBack;
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0].price
              }
              if(selectedOddsValue != 0 && betRate <= selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);

            } 
            else if (type == 1) {
              const ApiResponseOdds = runnerFromAPI.ExchangePrices?.AvailableToLay
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0]?.price
              }
              if(selectedOddsValue != 0 && betRate >=  selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } 
          }, 1000 * i);
        }
      }
      else if (type == 1 && betRate < selectedBetRate){
        console.log(" type == 1 && betRate < selectedBetRate ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }
      else if (type == 0 && betRate > selectedBetRate){
        console.log(" type == 1 && betRate < selectedBetRate ");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if (type == 1 &&  selectedBetRate != betRate){
        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToLay;
            console.log(" ================ ApiResponseOdds ================ ", ApiResponseOdds);
            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue <= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
        }
      }

      else if (type == 0 &&  selectedBetRate != betRate){
        for (let i = 0; i < 4; i++) {
          setTimeout( async () => {      
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToBack;
            console.log(" ================ ApiResponseOdds ================ ", ApiResponseOdds);
            let selectedOddsValue = ApiResponseOdds[0]?.price
            console.log( " =================== selectedOddsValue =============== ", selectedOddsValue );
            if(selectedOddsValue >= betRate){
              multipeResponse.push(selectedOddsValue)
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue)
          }, 1000*i);  
        }
      }
    }

    // cricket Toss 
    else if (config.sportMarkets.includes(marketId) &&  subMarketDetail.Id == config.Toss){
      console.log(" ======================== Soccer  Match Odds ======================== ");

      const DBOddDetails  = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets  = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
      runnerName = OddDetailsTeam?.runnerName
      console.log(" ============================ ========================== ", runnerForSaveInbets);

      if(selectedBetRate == betRate){
        for (let i = 1; i < 5; i++) {
          setTimeout( async () => {
            const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            console.log(" ================ oddsData ================ ", oddsData);
            const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
            let selectedOddsValue   = 0;
            if (type == 0) {
              const ApiResponseOdds = runnerFromAPI?.ExchangePrices?.AvailableToBack;
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0].price
              }
              if(selectedOddsValue != 0 && betRate <= selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);

            } 
            else if (type == 1) {
              const ApiResponseOdds = runnerFromAPI.ExchangePrices?.AvailableToLay
              console.log(" =============== ApiResponseOdds ============ ", ApiResponseOdds);
              if(ApiResponseOdds && ApiResponseOdds.length > 0){
                selectedOddsValue = ApiResponseOdds[0]?.price
              }
              if(selectedOddsValue != 0 && betRate >=  selectedOddsValue){
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } 
          }, 1000 * i);
        }
      }
      else {
        return res.status(404).send({
          message: `Bet miss matched`
        });
      }
    }

    //for fancy
    else if (subMarketDetail.Id == config.Fancy){
      if(![1960, 1968, 1971,1974, 1973, 1975, 1978,1979,1980,1981,1982,1983,1984,1985].includes(req.decoded.userId)){
        //return res.status(404).send({ message: 'Betting disabled' });
      }
      isManuel = false;
      const fancyBetLimit  = await userBetSizes.findOne({ userId: userId, sportsId: marketId, subarket: config.Fancy }).exec();
      if(!userMaxBetSize){
        return res.status(404).send({ message: `something went wrong !` });
      }
      if (fancyBetLimit && betAmount > fancyBetLimit.amount) {
        return res.status(404).send({ message: `max bet size is : ${fancyBetLimit.amount}` });
      }

      console.log(" fancyBetLimit ========== ", fancyBetLimit);
      console.log(" subMarketDetail.Id ========== ", subMarketDetail.Id);
      isFancyOrBookMaker = true;
      const eventId = eventDetail.Id
      const url = `${config.fancyUrl}/bm_fancy/${eventId}`;
      const response = await axios.get(url);
      console.log(" ================== API response ================== ", response);
      const apiFancyOdds = response?.data?.data?.t3;
      const DBOddDetails = await FancyOdds.findById(oddsId);
      const dbFancyOdds = DBOddDetails?.data?.data?.t3
      console.log(" apiFancyOdds ====== ", apiFancyOdds);
      console.log(" dbFancyOdds  ====== ", dbFancyOdds);
      if (apiFancyOdds?.length && dbFancyOdds?.length) {
        const apiSelectedOdds = apiFancyOdds.find(runner => runner.sid == selectionId);
        const dbSelectedOdds = dbFancyOdds.find(runner => runner.sid == selectionId);

        if (!apiSelectedOdds || !dbSelectedOdds) {
          console.log(" apiSelectedOdds ====== ", apiSelectedOdds);
          console.log(" dbSelectedOdds ====== ", dbSelectedOdds);

          console.log(`Odds not available for the selected team ${selectionId}`);
          return res.status(404).send({ message: `Odds not available for the selected team ${selectionId}` });
        }
        console.log(" apiSelectedOdds ====== ", apiSelectedOdds);
        console.log(" dbSelectedOdds ====== ", dbSelectedOdds);
        // Get the runner name from the 'nat' field
        fancyData  = dbSelectedOdds.nat
        runnerName = dbSelectedOdds.nat; 
        _3rdPartyMarketId = dbSelectedOdds.nat;

        if (req.body.type == 0) {
          const apiBackOdds2 = [apiSelectedOdds.l1, apiSelectedOdds.l2, apiSelectedOdds.l3];
          const apiBackOdds  = apiBackOdds2.map(item => Number(item))

          const DbBackOdds2 = [dbSelectedOdds.l1, dbSelectedOdds.l2, dbSelectedOdds.l3];
          const DbBackOdds  = DbBackOdds2.map(item => Number(item))

          const DbBackScores2 = [dbSelectedOdds.ls1, dbSelectedOdds.ls2, dbSelectedOdds.ls3];
          const DbBackScores  = DbBackScores2.map(item => Number(item))
          console.log(" DbBackOdds ============ ", DbBackOdds);
          const index = DbBackOdds.indexOf(betRate)
          TargetScore = betRate

          if (index == -1) {
            console.log(`index ================== ${index}`);
            console.log(`betRate ==================  ${betRate}`);
            return res.status(404).send({ message: `Bet miss matched` });
          }
          if (apiBackOdds[index] < betRate) {
            console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
            return res.status(404).send({ message: `Bet miss matched ` });
          }
        }
        else if (req.body.type == 1) {
          const apiBackOdds2 = [apiSelectedOdds.b1, apiSelectedOdds.b2, apiSelectedOdds.b3];
          const apiBackOdds = apiBackOdds2.map(item => Number(item));

          const DbBackOdds2 = [dbSelectedOdds.b1, dbSelectedOdds.b2, dbSelectedOdds.b3];
          const DbBackOdds = DbBackOdds2.map(item => Number(item));

          const DbBackScores2 = [dbSelectedOdds.bs1, dbSelectedOdds.bs2, dbSelectedOdds.bs3];
          const DbBackScores = DbBackScores2.map(item => Number(item));

          console.log(" DbBackOdds ============ ", DbBackOdds);

          const index = DbBackOdds.indexOf(betRate);
          TargetScore = betRate

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
        console.log(" =================== isFancyOrBookMaker ========================== ", isFancyOrBookMaker);
      }
      else {
        console.log(`Odds not available for the selected team ${req.body.selectionId}`);
        return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
      }
    }

    // for bookmaker
    else if (subMarketDetail.Id == config.BookMaker) {
      const bookMakerBetLimit  = await userBetSizes.findOne({ userId: userId, sportsId: marketId, subarket: config.BookMaker }).exec();
      if(!bookMakerBetLimit){
        return res.status(404).send({ message: `something went wrong !` });
      }
      if (bookMakerBetLimit && betAmount > bookMakerBetLimit.amount) {
        return res.status(404).send({ message: `max bet size is : ${bookMakerBetLimit.amount}` });
      }

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
      runners = dbFancyOdds;
      _3rdPartyMarketId = "Bookmaker";
      runnerForSaveInbets  = runners.map((runner) => ({
        runner: runner.sid,
        amount: 0
      }));
      console.log(" apiFancyOdds ==== ", apiFancyOdds)
      console.log(" dbFancyOdds ==== ", dbFancyOdds)

      if (apiFancyOdds.length && dbFancyOdds.length) {
        const apiSelectedOdds = apiFancyOdds.find(runner => runner.sid == req.body.selectionId);
        const dbSelectedOdds = dbFancyOdds.find(runner => runner.sid == req.body.selectionId);

        if (!apiSelectedOdds || !dbSelectedOdds) {
          console.log(`Odds not available for the selected team ${req.body.selectionId}`);
          return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
        }
        fancyData = null;
        runnerName = dbSelectedOdds.nat; 
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
      const FigureEvenOddSmallBig  = await userBetSizes.findOne({ userId: userId, sportsId: marketId, subarket: subMarketDetail.Id }).exec();
      if (FigureEvenOddSmallBig && betAmount > FigureEvenOddSmallBig.amount) {
        return res.status(404).send({ message: `max bet size is : ${FigureEvenOddSmallBig.amount}` });
      }

      let score = await cricketLiveScore(eventDetail.Id);
      if (!score) {
        return res.status(404).json({
          status: false,
          message: `Bet Not Allowed`
        });
      }
      let currentOver = score.overs;
      let type        = score.type
      let inning = score.inning;
      let sessionAddition = 0;
      if(inning == 2){
        if(type == "TEST"){
          sessionAddition = 9
        }else if (type == "ODI"){
          sessionAddition = 10
        }
        else if (type == "T20"){
          sessionAddition = 4
        }else if (type == "T10"){
          sessionAddition = 2
        }
      }
      let totalSessions = 0
      if (currentOver % 5 == 0) currentOver += 1
      let currentSessionOver = Math.ceil(currentOver % 5);
      currentSession = Math.ceil(currentOver / 5) + sessionAddition;
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

      if (inning == 2 && currentSession == totalSessions+sessionAddition) {
        return res.status(404).send({
          success: false,
          message: 'betting not allowed !',
          currentSession: currentSession,
          totalSessions: totalSessions,
          currentSessionOver: currentSessionOver,
        });
      }
      else if (currentSessionOver > 3) {
        console.log(" ================ currentSessionOver ================ ", currentSessionOver);
        
        return res.status(404).send({
          success: false,
          message: `betting not Allowed in ${Math.ceil(currentOver % 5)} over`,
          currentSession: currentSession,
          totalSessions: totalSessions,
          over: currentOver
        })

      }
      _3rdPartyMarketId = subMarketDetail.Id 
      console.log("Bets are Allowed");
      console.log(" currentSession ========= ", currentSession);
    }

    else {
      return res.status(404).send({ message: `Error Placing bet (Inappropriate Request)` });
    }

    /* =================================================================== */ 

    let  delay = 4100
    const delayExcludedMarkets = [...config.FigureEvenOddSmallBig, config.Fancy, config.BookMaker]
    if(delayExcludedMarkets.includes(subMarketDetail.Id)){
      delay = 1
    }

    setTimeout( async () => {

      console.log(" ============================ multipeResponse ============================ ", multipeResponse);
      console.log(" ============================ multipeResponseForSecurityCheck ============================ ", multipeResponseForSecurityCheck);

      console.log(" Pre Bet Rate ===============  ", betRate);
      console.log( " selectedBetRate ===============  ", selectedBetRate);

      if(multipeResponse.length == 0 && !delayExcludedMarkets.includes(subMarketDetail.Id)){
        console.log(" multipeResponse Is Empty !");
        return res.status(404).send({
          message: `Bet Miss Matched `
        });
      }

      else if(multipeResponse.length > 0  && !delayExcludedMarkets.includes(subMarketDetail.Id)){
        betRate = multipeResponse[multipeResponse.length - 1]
        console.log(" Inside  Bet Rate ===============  ", betRate);
      }
      console.log(" Post Bet Rate ===============  ", betRate);

      /* Winning Loosing Calculations  */

      if (type == 4)  {
        winningAmount = betAmount;
        loosingAmount = betAmount;
        selectionId == 0? runnerName = `CHOTA` : runnerName = `BARA`;
        runnerForSaveInbets  = [
          { "runner": 1, "amount": 0 },
          { "runner": 0, "amount": 0 }
        ]
        expoisureType = 2
      }
      else if (type == 3)  {
        winningAmount = betAmount;
        loosingAmount = betAmount;
        selectionId == 0? runnerName = `KALI` : runnerName = `JOTTA`;
        runnerForSaveInbets  = [
          { "runner": 1, "amount": 0 },
          { "runner": 0, "amount": 0 }
        ]
        expoisureType = 2
      }
      else if (type == 2) {
        winningAmount = (betAmount * betRate);
        loosingAmount = betAmount;
        runnerName    = `Figure(${selectionId})`
        runnerForSaveInbets  = [
          { "runner": 0, "amount": 0 },
          { "runner": 1, "amount": 0 },
          { "runner": 2, "amount": 0 },
          { "runner": 3, "amount": 0 },
          { "runner": 4, "amount": 0 },
          { "runner": 5, "amount": 0 },
          { "runner": 6, "amount": 0 },
          { "runner": 7, "amount": 0 },
          { "runner": 8, "amount": 0 },
          { "runner": 9, "amount": 0 }
        ];
        expoisureType = 2;
      }
      else if (type == 1 &&  !config.ExcludedBackLay.includes(subMarketDetail.Id)) {
        winningAmount = betAmount;
        loosingAmount = (betAmount * betRate) - betAmount;
      }
      else if (type == 0 && !config.ExcludedBackLay.includes(subMarketDetail.Id)) {
        winningAmount = (betAmount * betRate) - betAmount;
        loosingAmount = betAmount;
      }
      else if (type == 1 &&  subMarketDetail.Id == config.BookMaker) {
        // ((rate) /100 ) * bet_amount = loosing amount 
        loosingAmount =  (betRate * betAmount) /100;
        winningAmount = betAmount;
        console.log(" 1 loosingAmount =========  ", loosingAmount);
      }
      else if (type == 0 && subMarketDetail.Id == config.BookMaker) {
        // ((rate) /100 ) * bet_amount = winning amount 
        winningAmount = (betRate * betAmount)/100;
        loosingAmount = betAmount;
        console.log(" 0  loosingAmount =========  ", winningAmount);
      }
      else if (type == 0 &&  subMarketDetail.Id == config.Fancy) {
        // (Value showing below/100)*bet amount = loosing amount
        loosingAmount =  (fancyRate/100) * betAmount;
        winningAmount = betAmount;
        runnerForSaveInbets  = [
          { "runner": 1, "amount": 0 },
          { "runner": 0, "amount": 0 }
        ]
      }
      else if (type == 1 && subMarketDetail.Id == config.Fancy) {
        // Value showing below/100)*bet amount = winning amount
        winningAmount = (fancyRate/100) * betAmount;
        loosingAmount = betAmount;
        runnerForSaveInbets  = [
          { "runner": 1, "amount": 0 },
          { "runner": 0, "amount": 0 }
        ]
      }

      /* ------------ */

      /*  Current Position Of Runners  Calculations   */ 
      let runnersPosition = [];
      let prevExpAmount = 0;
      let expAmount =  0;
      console.log(" ================ Selection ID ================ ", selectionId);
      if(subMarketDetail.Id == config.Fancy){
        expAmount = loosingAmount
        let lastBetsCount = await Bets.countDocuments({
          marketId: _3rdPartyMarketId,
          userId: req.decoded.userId,
          matchId: matchId,
          status: 1,
          fancyData: fancyData,
          TargetScore:TargetScore
        });
        console.log(" ================== lastBetsCount ================  ", lastBetsCount);

        if(lastBetsCount > 0){
          const lastBet = await Bets.find({
            marketId: _3rdPartyMarketId,
            userId: req.decoded.userId,
            matchId: matchId,
            status: 1,
            fancyData: fancyData,
            TargetScore: TargetScore
          }).sort({ _id: -1 }).limit(1);
          console.log(" =================== lastBet ====================  ", lastBet[0].runnersPosition);
          const fancyNewPosition = lastBet[0].runnersPosition.map((item)=>{
            if(item.runner == type){
              item.amount = item.amount + winningAmount
            }else {
              item.amount = item.amount + (-loosingAmount)
            }
            return item 
          })
          runnersPosition =  fancyNewPosition,
          prevExpAmount =  lastBet[0].exposureAmount;
        }else {
          const runnerCurrentPosition  = runnerForSaveInbets.map((item)=>{
            if(item.runner == type){
              item.amount = item.amount + winningAmount
            }else {
              item.amount = item.amount - loosingAmount
            }
            return item 
          })
          runnersPosition = runnerCurrentPosition;
        }
        
        expAmount = runnersPosition.reduce((min, current) => {
          return current.amount < min.amount ? current : min;
        }, runnersPosition[0]);
        expAmount = expAmount.amount;
        expAmount = expAmount < 0 ?  Math.abs(expAmount) : 0
        
      }
      else if(expoisureType == 2){
        let lastBetsCount = await Bets.countDocuments({
          marketId: _3rdPartyMarketId,
          userId: req.decoded.userId,
          betSession: currentSession,
          matchId: matchId,
          status: 1
        });
        /*  ============================ */
        if(lastBetsCount > 0){
          let lastBet = await Bets.find({
            marketId: _3rdPartyMarketId,
            userId: req.decoded.userId,
            betSession: currentSession,
            matchId: matchId,
            status: 1
          }).sort({ _id: -1 }).limit(1);
          console.log(" ============= lastBet ", lastBet);
          const lastrunnersPosition = lastBet[0].runnersPosition;
          runnersPosition = lastrunnersPosition.map((item)=>{
            if(item.runner == selectionId){
              item.amount = item.amount + winningAmount
            }else {
              item.amount = item.amount - loosingAmount
            }
            return item 
          })
          prevExpAmount = lastBet[0].exposureAmount
        }
        else {
          runnersPosition = runnerForSaveInbets.map((item)=>{
            if(item.runner == selectionId){
              item.amount = item.amount + winningAmount
            }else {
              item.amount = item.amount - loosingAmount
            }
            return item 
          })
        }
        expAmount = runnersPosition.reduce((min, current) => {
          return current.amount < min.amount ? current : min;
        }, runnersPosition[0]);
        expAmount = expAmount.amount;
        console.log(" ================ RUNNER INFO ================ ", runnersPosition);
        console.log(" ================ EXP AMOUNT ================ ", expAmount);
        expAmount = expAmount < 0 ?  Math.abs(expAmount) : 0
        /* ============================= */ 
      }
      else {
        let lastBetsCount = await Bets.countDocuments({
          marketId: _3rdPartyMarketId,
          userId: req.decoded.userId,
          matchId: matchId,
          status: 1
        });
        console.log(" ======================= Total Count of Prev Bets ", lastBetsCount);
        if(lastBetsCount){
          const resp = await calculateExposure(_3rdPartyMarketId, req.decoded.userId, type, selectionId, loosingAmount, winningAmount, expoisureType, matchId);
          runnersPosition =  resp.runnersPosition;
          prevExpAmount =  resp.prevExpAmount;
        }else {
          if(type == 0){
            const runnerCurrentPosition  = runnerForSaveInbets.map((item)=>{
              if(item.runner == selectionId){
                item.amount = item.amount + winningAmount
              }else {
                item.amount = item.amount - loosingAmount
              }
              return item 
            })
            console.log(" ================== runnerCurrentPosition ================== ", runnerCurrentPosition);
            runnersPosition = runnerCurrentPosition;
            console.log(" ================== runnersPosition ================== ", runnersPosition);
            
          }else if(type == 1){
            runnersPosition = runnerForSaveInbets.map((item)=>{
              if(item.runner == selectionId){
                item.amount = item.amount - loosingAmount
              }else {
                item.amount = item.amount + winningAmount
              }
              return item 
            })
          }
        }

        console.log(" ================ runner For SaveIn bets INFO ================ ", runnerForSaveInbets);
        console.log(" ================ RUNNER INFO ================ ", runnersPosition);
        console.log(" ================ EXP AMOUNT ================ ", expAmount);
        
        expAmount = runnersPosition.reduce((min, current) => {
          return current.amount < min.amount ? current : min;
        }, runnersPosition[0]);
        expAmount = expAmount.amount;
        console.log(" ================ RUNNER INFO ================ ", runnersPosition);
        console.log(" ================ EXP AMOUNT ================ ", expAmount);
        expAmount = expAmount < 0 ?  Math.abs(expAmount) : 0
      }
      /* ------------ */
      /* Placing Bet Area  */ 
      const bet = new Bets({
        marketId: _3rdPartyMarketId,
        sportsId: marketId,
        runnerName:runnerName,
        userId,
        betAmount,
        betRate: betRate,
        selectedBetRate: selectedBetRate,
        TargetScore: TargetScore,
        matchId: matchId,
        loosingAmount: loosingAmount,
        winningAmount: winningAmount,
        subMarketId: subMarketDetail.Id,
        betSession: currentSession ? currentSession : null,
        runner: selectionId ? selectionId : '',
        type: type,
        status: 1,
        event: eventDetail.name,
        isfancyOrbookmaker: isFancyOrBookMaker,
        fancyData: fancyData,
        fancyRate: fancyRate,
        exposureAmount: expAmount,
        runnersPosition: runnersPosition,
        ratesRecord: multipeResponseForSecurityCheck,
        betTime: BetTime,
        multipeResponse: multipeResponse,
        isManuel: isManuel
      });
      console.log('userAvailableBalance', user.availableBalance)

      if ( user.availableBalance < expAmount-prevExpAmount ) {
        return res.status(404).send({ message: 'Insufficient balance' });
      }

      if(subMarketDetail.Id != config.Fancy){
        let setCalculateExpFalse = await Bets.updateMany(
          { marketId: _3rdPartyMarketId, userId: userId, matchId: matchId, status: 1 },
          {calculateExp: false}
        );
      }

      if(subMarketDetail.Id == config.Fancy){
        let setCalculateExpFalse = await Bets.updateMany(
          { 
            marketId: _3rdPartyMarketId,
            userId: req.decoded.userId,
            matchId: matchId,
            status: 1,
            fancyData: fancyData
          },
          {calculateExp: false}
        );
      }

      bet.save(async (err, result) => {
        if (err) {
          console.log('err', err);
          return res.status(404).send({ message: `Error placing bet ${err}` });
        }
        try {
          console.log( " ========================== result ========================== ", result);
          const position = new currentPosition({
            userId: userId,
            amount: - loosingAmount,
            matchsId: matchId,
            betId: result._id,
          })
          await position.save();
  
          const totalExpAmount = expAmount - prevExpAmount
          const updatedUser = await User.findOneAndUpdate(
            { userId: userId },
            {
              $inc: {
                availableBalance: -totalExpAmount,
                exposure: -totalExpAmount
              },
            },
          );
          await updateParentUserBalance(parentUserIds, winningAmount, matchId, result._id, selectionId, _3rdPartyMarketId);
  
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
      /* -------------- */ 

    }, delay);

  } catch (error) {
    console.error('error', error);
    return res.status(404).send({ message: `Error placing bet ${error}` });
  }
}

async function calculateExposure(marketId, userId, type, selectedRunner, loosingAmount, winningAmount, expoisureType, matchId){
  console.log(" = marketId =", marketId);
  let lastBet = await Bets.find({
    marketId: marketId,
    userId: userId,
    matchId: matchId,
    status: 1
  }).sort({ _id: -1 }).limit(1);

  console.log(" ============= lastBet ", lastBet);
  const lastrunnersPosition = lastBet[0].runnersPosition;
  let newPosition;
  if(type == 0){
    console.log(" ================= Back is called  =================  ");
    newPosition = lastrunnersPosition.map((item)=>{
      if(item.runner == selectedRunner){
        item.amount = item.amount + winningAmount
      }else {
        item.amount = item.amount + (-loosingAmount)
      }
      return item 
    })
  }
  else if(type == 1){
    console.log(" ================= Lay is called  =================  ");
    newPosition = lastrunnersPosition.map((item)=>{
      if(item.runner == selectedRunner){
        item.amount = item.amount + (-loosingAmount)
      }else {
        item.amount = item.amount + winningAmount
      }
      return item 
    });
  }
  return {
    runnersPosition: newPosition,
    prevExpAmount:lastBet[0].exposureAmount
  }
}

async function getUserBets(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length != 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    // Initialize variables with default values
    let query = {};
    let page = 1;
    let sort = -1;
    let sortValue = 'createdAt';
    let limit = config.pageSize;
    if (req.body.numRecords || isNaN(req.body.numRecords) || req.body.numRecords > 0) {
      limit = Number(req.body.numRecords);
    }
    if (req.body.sortValue)   sortValue = req.body.sortValue;
    if (req.body.sort)        sort      = Number(req.body.sort);
    if (req.body.page)        page      = Number(req.body.page);
    if (req.body.startDate && req.body.endDate) {
      const startTimestamp = new Date(req.body.startDate).getTime();
      const endTimestamp = new Date(req.body.endDate).getTime();
      query.createdAt = {
        $gte: startTimestamp,
        $lte: endTimestamp,
      };
    }

    if(req.body.status){
      query.status = req.body.status;
    }

    if (req.decoded.role != '5') query.userId = req.body.userId;
    else if (req.decoded.role == '5') query.userId = req.decoded.userId;

    if (req.body.status) query.status = req.body.status;
    if (req.body.sportsId) query.sportsId = req.body.sportsId;
    if(req.body.searchValue) query.event = { $regex: req.body.searchValue, $options: 'i' };

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

    Bets.paginate(
      query,
      { page: page, sort: { [sortValue]: sort }, limit: limit },
      (err, results) => {
        if (err) return res.status(404).send({ message: `Something went wrong  ${err} ` });
        return res.send({
          success: true,
          message: 'bets list',
          results: results,
        });
      }
    );
  } catch (error) {
    return res.send({
      success: false,
      message: 'Something goes wrong catched'
    }); 
  }
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

    const bettorMaster      = await User.findOne({ userId: loginUser.createdBy });
    const userOfLoginUser   = await User.find({ createdBy: loginUser.userId });
    const createdByIDs      = userOfLoginUser.map(user => user.userId);

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
          fancyRate: '$fancyRate',

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
      },
      { $sort: { _id: -1 } }
    ]).exec();

    // if (!matchedBets || matchedBets.length == 0) {
    //   return res.status(200).send({ message: 'Matched bets not found', data: [] });
    // }

    const eventId       = await Events.findById(matchId);
    const relatedEvents = await Events.find({
      sportsId: eventId.sportsId,
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
    return res.status(500).send({ message: 'Error retrieving matched bets', 
    error: err 
  });
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
        response.type   = event.matchType;
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
    // console.log("===================== CALL START POINT =====================");
    const eventsIds = await Events.distinct("Id", { sportsId: "4", inplay: true, status: { $in:['OPEN', 'open'  ] }});
    console.log(" eventsIds ===================== ", eventsIds);
    
    for (let Id of eventsIds){
      console.log("Id ===================== ", Id);
      const event = await Events.findOne({ Id: Id }, { _id: 0, matchType: 1, sportsId: 1 });
      console.log(" event ===================== ", event);
      const type  = event.matchType;
      // console.log(" type ===================== ", type);
      if(config.matchTypes.includes(type)){
        // console.log(" Returnning due to invalid  ===================== ", type);
        const score           = await cricketLiveScore(Id);
        console.log("score ===================== ", score);
        if(score != 0){
          let currentScore    = Number(score.score)
          const sessionLength   = type == "TEST" ? 10 : 5;
          config.balls.includes(score.balls[5]) ? currentScore = currentScore - Number(score.balls[5]) : ''
          let currentOver = score.overs;
          let ball        = currentOver.split('.')[1]
          let inning      = score.inning;  

          if(currentOver % sessionLength < 1  && (ball == 1 )){
            // console.log(" conditional ball  ===================== ", ball)
            // console.log(" conditional over ===================== ", score.overs % sessionLength);
            let sessionAddition =  0 ;
            if(inning == 2){
              if(type == "TEST"){
                sessionAddition = 9
              }else if (type == "ODI"){
                sessionAddition = 10
              }
              else if (type == "T20"){
                sessionAddition = 4
              }else if (type == "T10"){
                sessionAddition = 2
              }
            }
            let sessionToResult      = Math.floor(currentOver/sessionLength) + sessionAddition;
            console.log(" session To Result ===================== ", sessionToResult);
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
      }else {
        console.log("Invalid Match Type ");
      }
    }
    // console.log("===================== CALL END POINT =====================");

  } catch (error) {
      console.error('Error running odds cron job:', error);
  }
}

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

const profitLose = async(req, res) => {
  if(!req.query.userId){
    console.log("line 2579 Something Went Wrong!");
    return res.status(404).send({
      success: false,
      message: 'Something Went Wrong!'
    });
  }
  try {

    const userId      = parseInt(req.query.userId)
    const currentUser = await User.findOne({ userId: userId});
    if(!currentUser){
      return res.status(404).send({
        success: false,
        message: 'Something Went Wrong!'
      });
    }
    if(currentUser.role == '5'){
      const response    = await Cash.aggregate([
        {
          $match: {
              userId: userId,
              cashOrCredit: { $in: ["Bet"] }
          }
        },
        {
          $addFields: {
            'betsId': { $toObjectId: "$betId" }
          }
        },
        {
          $lookup: {
            from: 'markettypes',
            localField: 'sportsId',
            foreignField: 'Id',
            as: 'marketInfo'
          }
        }, 
        {
          $group:{
            _id: "$sportsId",
            amount: { $sum: "$amount"},
            userId: { $first: "$userId" },
            name: { $first: { $arrayElemAt: ["$marketInfo.name", 0] } }
          }
        }
      ]);
      return res.send({
        success: true,
        message: 'Profit Lose reports',
        results: response
      });

    }else {
      const response = await Cash.aggregate([
        {
          $match: {
            userId: userId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
          }
        },
        {
          $lookup: {
            from: 'markettypes',
            localField: 'sportsId',
            foreignField: 'Id',
            as: 'marketInfo'
          }
        }, 
        {
          $group:{
            _id: "$sportsId",
            amount: { $sum: "$amount"},
            userId: { $first: "$userId" },
            name: { $first: { $arrayElemAt: ["$marketInfo.name", 0] } }
          }
        }
      ]);
      return res.send({
        success: true,
        message: 'Profit Lose Reports',
        results: response
      });
    }
  } catch (error) {
    console.log("Catched", error);
    return res.status(404).send({
      success: false,
      message: 'Something Went Wrong!'
    });
  }
}

const EventWiseprofitLose = async(req, res) => {
  if(!req.query.userId || !req.query.sportsId){
    return res.status(404).send({
      success: false,
      message: 'Invalid Request'
    });
  }
  try {
    const userId      = parseInt(req.query.userId);
    const sportsId    = req.query.sportsId;
    const currentUser = await User.findOne({ userId: userId});
    if(!currentUser){
      console.log("line 2682 Something Went Wrong!");
      return res.status(404).send({
        success: false,
        message: 'Something Went Wrong!'
      });
    }
    if(currentUser.role == '5'){
      const response    = await Cash.aggregate([
        {
          $match: {
              userId: userId,
              sportsId: sportsId,
              cashOrCredit: { $in: ["Bet"] }
          }
        },
        {
          $addFields: {
            'betsId': { $toObjectId: "$betId" }
          }
        },
        {
          $lookup: {
            from: 'bets',
            localField: 'betsId',
            foreignField: '_id',
            as: 'bets'
          }
        }, 
        {
          $group:{
            _id: {$arrayElemAt: ["$bets.matchId", 0]},
            amount: { $sum: "$amount"},
            userId: { $first: "$userId" },
            date: { $first: "$date" },
            name: { $first: { $arrayElemAt: ["$bets.event", 0] } },
          }
        }
      ]);
      return res.send({
        success: true,
        message: 'Profit Lose reports',
        results: response
      });

    }else {

      // const users       = [userId];
      // let parents       = [userId];
      // let childUsers;
      // do{
      //   childUsers     = await User.distinct("userId", {
      //     createdBy: {
      //       $in: parents
      //     }
      //   });
      //   console.log(" child users ======= ", childUsers);
      //   if(childUsers.length) users.push(...childUsers)
      //   parents = childUsers
      // }while (childUsers.length > 0)
    
      // console.log(" users list  ======== ", users);
    
      const response = await Cash.aggregate([
        {
          $match: {
            userId: userId,
            sportsId:sportsId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
          }
        },
        {
          $addFields: {
            'betsId': { $toObjectId: "$betId" }
          }
        },
        {
          $lookup: {
            from: 'bets',
            localField: 'betsId',
            foreignField: '_id',
            as: 'bets'
          }
        }, 
        {
          $group:{
            _id: {$arrayElemAt: ["$bets.matchId", 0]},
            amount: { $sum: "$amount"},
            userId: { $first: "$userId" },
            date: { $first: "$date" },
            name: { $first: { $arrayElemAt: ["$bets.event", 0] } },
          }
        }
      ]);
      return res.send({
        success: true,
        message: 'Profit Lose Reports',
        results: response
      });
    }
  } catch (error) {
    console.log("Catched", error);
    console.log("line 2783 Something Went Wrong!");
    return res.status(404).send({
      success: false,
      message: 'Something Went Wrong!'
    });
  }
}

const dailyMatchWiseprofitLose = async(req, res) => {
  if(!req.query.userId || !req.query.matchId){
    return res.status(404).send({
      success: false,
      message: 'Invalid Request'
    });
  }
  try {
    const userId      = parseInt(req.query.userId)
    const matchId     = req.query.matchId;
    const currentUser = await User.findOne({ userId: userId});
    const parent      = await User.findOne({ userId: currentUser.createdBy});
    const match       = await Events.findById(matchId)
    if(currentUser.role == '5'){
      const response = await Cash.aggregate([
        {
          $match: {
            matchId: matchId,
            $or: [
              {
                $and: [{
                  userId: userId,
                },
                {
                  cashOrCredit: { $in: ["Bet", "Commission", "loosing"] }
                }
                ]
              },
              {       
                cashOrCredit: { $in: ["Commission"] }
              }
            ]
          }
        },
        {
          $addFields: {
            'betsId': { $toObjectId: "$betId" }
          }
        },
        {
          $lookup: {
            from: 'bets',
            localField: 'betsId',
            foreignField: '_id',
            as: 'betsDetails'
          }
        }, 
        { 
          $group:{
            _id: "$betId",
            pl: { $sum: "$amount"},
            sattledAt: { $first: "$date" },
            price: { $first: { $arrayElemAt: ["$betsDetails.betAmount", 0] } },
            name: { $first: { $arrayElemAt: ["$betsDetails.runnerName", 0] } },
            createdAt: { $first: { $arrayElemAt: ["$betsDetails.createdAt", 0] } },
            size: { $first: { $arrayElemAt: ["$betsDetails.betRate", 0] } },
            type: { $first: { $arrayElemAt: ["$betsDetails.type", 0] } }

          }
        }
      ]);
      return res.send({
        success: true,
        message: 'Detailed reports',
        results: response,
        dealer: parent.userName,
        currentUser: currentUser.userName,
        Winner: match?.winner,
        isBattor: true
      });

    }else {
      const response = await Cash.aggregate([
        {
          $match: {
            matchId: matchId,
            userId: userId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing"] }
          }
        },
        {
          $addFields: {
            'betsId': { $toObjectId: "$betId" }
          }
        },
        {
          $lookup: {
            from: 'bets',
            localField: 'betsId',
            foreignField: '_id',
            as: 'betsDetails'
          }
        }, 
        { 
          $group:{
            _id: "$betId",
            pl: { $sum: "$amount"},
            sattledAt: { $first: "$date" },
            price: { $first: { $arrayElemAt: ["$betsDetails.betAmount", 0] } },
            name: { $first: { $arrayElemAt: ["$betsDetails.runnerName", 0] } },
            createdAt: { $first: { $arrayElemAt: ["$betsDetails.createdAt", 0] } },
            size: { $first: { $arrayElemAt: ["$betsDetails.betRate", 0] } },
            type: { $first: { $arrayElemAt: ["$betsDetails.type", 0] } }

          }
        }
      ]);
      return res.send({
        success: true,
        message: 'Detailed reports',
        results: response,
        dealer: parent?.userName,
        currentUser: currentUser?.userName,
        Winner: match?.winner,
        isBattor: false
      });
    }
  } catch (error) {
    console.log("Catched", error);
    console.log("line 2910 Something Went Wrong!");
    return res.status(404).send({
      success: false,
      message: 'Something Went Wrong!'
    });
  }
}




const postmanwork = async (req, res)=>{
  try{
    // const users = await User.find({ role: { $ne: '0' }  });
    // await userBetSizes.deleteMany();
    // for (const user of users){
    //   const response = userBetSizes.insertMany([
    //     {
    //       userId: user.useerId,
    //       amount: 250000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd20',
    //       name: 'Soccer',
    //       sportsId: '1'
    //     },
    //     {
    //       userId: user.useerId,
    //       amount: 250000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd21',
    //       name: 'Tennis',
    //       sportsId: '2'
    //     },
    //     {
    //       userId: user.useerId,
    //       amount: 500000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd22',
    //       name: 'Cricket',
    //       sportsId: '4'
    //     },
    //     {
    //       userId: user.useerId,
    //       amount: 200000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd23',
    //       name: 'Fancy',
    //       subarket: 7,
    //       sportsId: '4'
    //     },
    //     {
    //       userId: user.useerId,
    //       amount: 200000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd24',
    //       name: 'Tied match',
    //       subarket: 35,
    //       sportsId: '4'
    //     },
    //     {
    //       userId: user.useerId,
    //       amount: 200000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd25',
    //       name: 'bookMaker',
    //       subarket: 8,
    //       sportsId: '4'
    //     },
    //     {
    //       userId: user.useerId,
    //       amount: 200000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd26',
    //       name: 'Even Odd',
    //       subarket: 10,
    //       sportsId: '4'
    //     },
    //     {
    //       userId: user.useerId,
    //       amount: 200000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd27',
    //       name: 'Chotta Bara',
    //       subarket: 34,
    //       sportsId: '4'
    //     },
    //     {
    //       userId: user.useerId,
    //       amount: 200000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd28',
    //       name: 'Figure',
    //       subarket: 9,
    //       sportsId: '4'
    //     },
    //     {
    //       userId: user.useerId,
    //       amount: 200000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd29',
    //       name: 'Horse races',
    //       sportsId: '7'
    //     },
    //     {
    //       userId: user.useerId,
    //       amount: 100000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd2a',
    //       name: 'GreyHound',
    //       sportsId: '4339'
    //     },
    //     {
    //       userId: user.useerId,
    //       amount: 50000,
    //       betLimitId: '64fc9f9fac96fd64a8d0bd2b',
    //       name: 'casino',
    //       sportsId: '6'
    //     }
    //   ])  
    // }

    // const deposits  = await Cash.find({ cashOrCredit: {
    //   $in: ["Bet", "Commission", "loosing"] 
    // } });
    // console.log(" deposits  ================= ", deposits.length);

    // for (let i = 0; i < deposits.length; i++) {
    //   console.log(" deposits ================= ", deposits[i]);
    //   const bet = await Bets.findOne({ _id: mongoose.Types.ObjectId(deposits[i].betId) });
    //   console.log(" ================= ", bet);
    //   if(bet){
    //     await Cash.updateOne(
    //       { _id: deposits[i]._id },
    //       { $set: { sportsId: bet.sportsId } }
    //     );
    //   }
    // }
    const _3oattires = await  axios.get("http://138.68.171.26:3003/teenpatti/t20");
    const _3oatti = _3oattires.data;


    const _3oattiresultRes = await  axios.get("http://138.68.171.26:3003/teenpatti/t20/result");
    const _3oattiResult = _3oattiresultRes.data;

    
     
    const teen8res = await  axios.get("https://betfairoddsapi.com:3445/api/l_result/teen8");
    const teen8 = teen8res.data;

    return res.send({
      message: "Completed !",
      _3oatti: _3oatti,
      _3oattiResult:_3oattiResult,
      teen8: teen8
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
loginRouter.get('/postmanwork', postmanwork);
loginRouter.get('/profitLose', profitLose);
loginRouter.get('/EventWiseprofitLose', EventWiseprofitLose);
loginRouter.get('/dailyMatchWiseprofitLose', dailyMatchWiseprofitLose);


module.exports = { sessionCalc,  loginRouter, getParents };
