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
const { log } = require('async');

const getParents = async (userId) => {
  const parentUserIds = [];
  let currentUserId = userId;
  console.log('currentUserId', currentUserId);

  while (currentUserId) {
    const parentUser = await User.findOne({ userId: currentUserId }).exec();
    // console.log('parentUser',parentUser);
    if (!parentUser || !parentUser.createdBy || parentUser.createdBy == currentUserId) {
      // console.log('if createdBy not found')
      break;
    }
    if (!parentUser || parentUser.createdBy == currentUserId) {
      // console.log('No more parent users.');
      break;
    }
    parentUserIds.push(parentUser.createdBy);
    currentUserId = parentUser.createdBy;
  }

  return parentUserIds;
}
const updateParentUserBalance = async (parentUsersIds, winningAmount, matchId = 0, Id=0 ) => {
  const parentUser = await User.find({
    userId: {
      $in: [...parentUsersIds],
    },
    isDeleted: false,
  }).sort({ role: -1 });


  let prev = 0;
  parentUser.forEach((user) => {
    let current = user.downLineShare;
    let  commission = current - prev;
    user["commission"] = commission;
    prev = current;
  });
  for (const user of parentUser){
    console.log(`user id ${ user.userId } =====`, user.commission);
    user.exposure -= (user.commission / 100) * winningAmount;
    user.availableBalance -= (user.commission / 100) * winningAmount;
    await user.save();
    console.log("Saving parent users" );
    if(matchId != 0){
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

// match odds fancy book maker etc 
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
    let testRunner;
    let currentSession;
    let subMarketDetail;
    let marketId;
    let selectedOddsRate;
    const { selectionId, betAmount, betRate, matchId, subMarketName, type, oddsId  } = req.body;
    const userId = req.decoded.userId;
    let ApiResponseOdds;
    let matchedIndex;
    let winningAmount = 0;
    let loosingAmount = 0;

    if( betAmount < config.betMinimumAmount) {
      return res.status(404).send({ message: `minimum bet should be ${config.betMinimumAmount}` });
    }
    const user = await User.findOne({ userId }).exec();
    if (!user) {
      return res.status(404).send({ message: 'illegal user betting' });
    }
    console.log('userAvailableBalance',user.availableBalance)
    if ((user.availableBalance < betAmount && type == 0) || (user.availableBalance < betAmount* (betRate -1) && type == 1) ) {
      return res.status(404).send({ message: 'Insufficient balance' });
    }
    if (user.bettingAllowed == false) {
      return res.status(404).send({message: 'Bet not allowed'});
    }
    let parentUserIds   = await getParents(user.userId);
    const marketIds     = await User.distinct("blockedMarketPlaces",          { userId :{ $in: parentUserIds},  isDeleted:false });
    const subMarketId1  = await User.distinct("blockedSubMarkets",            { userId :{ $in: parentUserIds }, isDeleted:false });
    const subMarketId2  = await User.distinct("blockedSubMarketsByParent",    { userId :{ $in: parentUserIds }, isDeleted:false });
    const subMarketId   = subMarketId1.concat(subMarketId2);
    const eventDetail   = await Events.findById(matchId);
    if(!eventDetail){
      return res.status(404).send({message: 'EVENT COULD NOT FOUND'});
    }
    marketId            = eventDetail?.sportsId;
    console.log(" marketId ======== ", marketId);
    let id;

    // Checks for Market Places & Sub Markets  
    if (config.raceMarkets.includes(marketId)){
      id = eventDetail.marketIds[0];
      subMarketDetail = await SubMarketType.findOne({ countryCode: subMarketName, marketId: marketId }).exec();
      if (!subMarketDetail) {
        return res.status(404).send({ message: 'Bet not allowed' });
      }
    }else {
      const currentMarket =  eventDetail?.marketIds?.find((market) => market.marketName ==  subMarketName );
      id = currentMarket?.id;
      subMarketDetail = await SubMarketType.findOne({ name: subMarketName, marketId: marketId }).exec();

      if (!subMarketDetail) {
        return res.status(404).send({ message: 'you cannot place bet' });
      }
    }

    if (marketIds.includes(marketId) || subMarketId.includes(subMarketDetail.Id) || user.betLockStatus == true || user.blockedSubMarketsByParent.includes(subMarketDetail.Id)){
      return res.status(404).send({ message: 'Betting disabled' });
    }  
    const userMaxBetSize = await userBetSizes.findOne({ userId: userId, sportsId: marketId }).exec();
    if (userMaxBetSize  && betAmount > userMaxBetSize.amount){
      return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
    }

    // cricket tennis soccer odds only mtch odds 
    if (config.sportMarkets.includes(marketId) && config.SportOddsSubMarkets.includes(subMarketDetail.Id)){
      const url      = `${config.sportsAPIUrl}/odds/?ids=${id}`;
      const response = await axios.get(url);
      const oddsData = response.data;
      if (!oddsData) {
        console.log(`Match odds not found for sports ID ${sportsId}`);
        return res.status(404).send({ message: `Bet mis match` });
      }
      console.log('data from  API', oddsData);
      const runnerFromAPI = oddsData[0]?.Runners.find(runner => runner.SelectionId == selectionId);
      testRunner = runnerFromAPI

      const DBOddDetails      = await Odds.findById(oddsId);
      if(!DBOddDetails){
        return res.status(404).send({ 
          message:  `Frontend provided odds _id do not found in db & _id =  ${oddsId}` 
        });
      }
      console.log("DBOddDetails === ", DBOddDetails);
      if (type == 0){
        ApiResponseOdds         = runnerFromAPI.ExchangePrices.AvailableToBack
        const OddDetailsTeam    = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
        const availableToBack   = OddDetailsTeam.ExchangePrices.AvailableToBack;
        console.log('availableToBack', availableToBack);
        matchedIndex            = availableToBack.findIndex((back) => {
          return back.price == betRate;
        });
        console.log('matchedIndex', matchedIndex);
        if (matchedIndex == -1) {
          console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
          return res.status(404).send({ message: `No availableToBack odds matched with the bet rate ${req.body.betRate}` });
        }
        selectedOddsRate = availableToBack[matchedIndex].price;

      } else if (type == 1){
        ApiResponseOdds         = runnerFromAPI.ExchangePrices.AvailableToLay
        const OddDetailsTeam    = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
        const AvailableToLay    = OddDetailsTeam.ExchangePrices.AvailableToLay;
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

      if(ApiResponseOdds[matchedIndex].price < betRate ){
        return res.status(404).send({ message: `Bet miss matched` });
      }
    }

    // HR GH odds market 
    if (config.raceMarkets.includes(marketId)){

      console.log("MarketId ========== ", id);
      const url       = `${config.horseRaceUrl}/odds/?ids=${id}`;
      const response  = await axios.get(url);
      const oddsData  = response.data;
      
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
      
      if (type == 0){
        ApiResponseOdds         = runnerFromAPI?.exchange?.availableToBack
        console.log("ApiResponseOdds AvailableToBack === ", ApiResponseOdds);

        const DBOddDetails      = await RaceOdds.findById(oddsId);
        console.log("DBOddDetails === ", DBOddDetails);
        const OddDetailsTeam    = DBOddDetails.runners.find((runner) => {
          return runner.selectionId == selectionId
        });
        const availableToBack   = OddDetailsTeam.exchange.availableToBack;
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

      } else if (type == 1){
        ApiResponseOdds         = runnerFromAPI.exchange.availableToLay
        console.log("ApiResponseOdds AvailableToLay ====== ", ApiResponseOdds);
        const DBOddDetails      = await RaceOdds.findById(oddsId);
        const OddDetailsTeam    = DBOddDetails.runners.find(runner => runner.selectionId == selectionId);

        const AvailableToLay    = OddDetailsTeam.exchange.availableToLay;
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

      if(ApiResponseOdds[matchedIndex].price < betRate ){
        return res.status(404).send({ message: `Bet miss matched` });
      }
    }

    //for fancy
    if (subMarketDetail.Id == config.Fancy ) {
      const eventId = match.Id
      const url = `${config.fancyUrl}/bm_fancy/${eventId}`;
      const response = await axios.get(url);
      const fancyOdds = response?.data.data;
      // console.log('fancyOdds',fancyOdds);
      console.log('fancyOddst3', fancyOdds?.t3);
      if (fancyOdds){
        const selectedTeamOdds = fancyOdds.t3.find(runner => runner.sid == req.body.selectionId);
        console.log('selectedTeamOdds', selectedTeamOdds);
        if (!selectedTeamOdds) {
          console.log(`Odds not available for the selected team ${req.body.selectionId}`);
          return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
        }
        runnerName = selectedTeamOdds.nat; // Get the runner name from the 'nat' field

        let selectedOddsRate = null;

        if (req.body.type === 0) {
          // If type is 0 (available to back), try to find a match between the user-provided betRate and any of the available back odds (b1, b2, or b3)
          const backOdds = [selectedTeamOdds.b1, selectedTeamOdds.b2, selectedTeamOdds.b3];
          console.log('backOdds', backOdds)
          selectedOddsRate = backOdds.find(back => back == req.body.betRate);
        } else if (req.body.type === 1) {
          const layOdds = [selectedTeamOdds.l1, selectedTeamOdds.l2, selectedTeamOdds.l3];
          console.log('layOdds', layOdds);
          selectedOddsRate = layOdds.find(lay => lay == req.body.betRate)
        }
        else {
          console.log('Invalid type value. Type should be 0 or 1.');
          return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
        }

        if (!selectedOddsRate || selectedOddsRate == '0.00') {
          // If odds are not available or suspended.
          console.log(`Selected odds for the bet are not available or suspended for the team ${req.body.selectionId}`);
          return res.status(404).send({ message: `Selected odds for the bet are not available or suspended for the team ${req.body.selectionId}` });
        }
        // Now you have the selectedOddsRate based on the selected team and type
        console.log('Selected Odds:', selectedOddsRate);
      }

    }
   
    // // for bookmaker
    if ( subMarketDetail.Id == config.BookMaker ) {
      console.log('in bookmakrer');
      const eventId = match.Id
      const url = `${config.fancyUrl}/bm_fancy/${eventId}`;
      const response = await axios.get(url);
      const bookMakerOdds = response?.data.data;
      console.log('bookMakerOdds', bookMakerOdds.t2[0]);
      // const bookMakerOdds = await FancyGames.find({
      //   eventTypeId: sportsId,
      //   eventId: match.Id,
      //   createdAt: selectedTime,
      // });
      console.log('bookMakerOdds====>', bookMakerOdds.t2[0].bm1);
      if (bookMakerOdds) {
        // Extract the odds data for the selected team from the "t3" array
        const selectedTeamOdds = bookMakerOdds.t2[0].bm1.find(runner => runner.sid == selectionId);

        if (!selectedTeamOdds) {
          console.log(`Odds not available for the selected team ${req.body.selectionId}`);
          return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
        }
        console.log('selectedTeamOdds', selectedTeamOdds);
        runnerName = selectedTeamOdds.nat //runnername

        let selectedOddsRate = null;
        if (req.body.type === 0) {
          // If type is 0 (available to back), try to find a match between the user-provided betRate and any of the available back odds (b1, b2, or b3)
          const backOdds = [selectedTeamOdds.b1, selectedTeamOdds.b2, selectedTeamOdds.b3];
          console.log('backOdds', backOdds);
          selectedOddsRate = backOdds.find(back => back == req.body.betRate);
        } else if (req.body.type === 1) {
          // If type is 1 (available to lay), use the "l1", "l2", or "l3" price for the lay odds
          const layOdds = [selectedTeamOdds.l1, selectedTeamOdds.l2, selectedTeamOdds.l3];
          selectedOddsRate = layOdds.find(lay => lay == req.body.betRate)
        }
        else {
          console.log('Invalid type value. Type should be 0 or 1.');
          return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
        }

        if (!selectedOddsRate || selectedOddsRate == '0.00') {
          // If odds are not available or suspended.
          console.log(`Selected odds for the bet are not available or suspended for the team ${req.body.selectionId}`);
          return res.status(404).send({ message: `Selected odds for the bet are not available or suspended for the team ${req.body.selectionId}` });
        }
        // Now you have the selectedOddsRate based on the selected team and type
        console.log('Selected Odds:', selectedOddsRate);
      }
    }

    if(config.FigureEvenOddSmallBig.includes(subMarketDetail.Id)){
      let score   = await liveSportScore(eventDetail.Id);
      if (!score){
        return res.json({ 
          status: false,
          message: `Bet Not Allowed : ${ score }` 
        });
      }

      return res.json({ 
        status: true,
        message: `Bet Allowed`,
        data: score
      });

      console.log(' score ====== ', score );
      let currentOver         = score.overs;
      let secondInnings       = score.secondInnings;  
      let totalSessions       = 0
      let currentSessionOver  = Math.ceil(currentOver%5);
      currentSession          = Math.ceil(currentOver/5);

      switch (eventDetail.matchType) {
        case 'T10':
          totalSessions       = 2;
          break;
        case 'T20':
          totalSessions       = 4;
          break;
        case 'ODI':
          totalSessions       = 10;
          break;
        case 'TEST':
          totalSessions       = 9;
          currentSessionOver  = Math.ceil(currentOver%10);
          currentSession      = Math.ceil(currentOver/10);
          break;
        default:
          return res.json(404, {
            success : false,
            message : `Match Type is not defined : ${eventDetail.matchType}`,
          });
          break;
      }

      if(secondInnings && currentSession == totalSessions){
        return res.send({
          success: false,
          message: 'betting not Allowed in last Session',
          currentSession : currentSession,
          totalSessions  : totalSessions,
          over           : currentSessionOver,
        });
      }
      else if(currentSessionOver > 3){
        return res.send({
          success : false,
          message : `betting not Allowed in ${currentOver} over`,
          currentSession : currentSession,
          totalSessions  : totalSessions,
          over           : currentOver
        })

      }
      console.log(" currentSession ========= ", currentSession);
    }

    if(config.FigureEvenOddSmallBig.includes(subMarketDetail.Id)){
      winningAmount = betAmount;
      loosingAmount = betAmount;
    }

    else if(type == 2){
      winningAmount = ( betAmount * betRate ) - betAmount;
      loosingAmount = betAmount;
    }

    else if(type == 0){
      winningAmount = ( betAmount * betRate ) - betAmount;
      loosingAmount = betAmount;
    } 

    else if(type == 1){
      winningAmount = betAmount;
      loosingAmount = (betAmount * betRate) - betAmount;
    }

    const bet = new Bets({
      marketId,
      userId,
      betAmount,
      betRate: betRate,
      matchId: matchId,
      loosingAmount: loosingAmount,
      winningAmount: winningAmount,
      subMarketId: subMarketDetail.Id,
      betSession: currentSession,
      runner: selectionId? selectionId : '',
      type: type,
      event:  eventDetail.name,
      createdAt: new Date().getTime()
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
  console.log("==========", req.decoded.userId);
  const bets = await Bets.find({ userId: req.decoded.userId });
  return res.send({
    success: true,
    message: 'bets record found',
    results: bets,
  });
  
  // =============================

  // Initialize variables with default values
  let query       = {};
  let page        = 1;
  let sort        = -1;
  let sortValue   = 'createdAt';
  var limit       = config.pageSize;
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
    console.log('bettorMaster', bettorMaster);
    const userOfLoginUser = await User.find({ createdBy: loginUser.userId });
    const createdByIDs = userOfLoginUser.map(user => user.userId);

    // Fetch all user IDs using optimized function
    const userIDs = await getAllUserIDs(createdByIDs);
    const matchId = req.query.id

    if (loginUser.role == '5') {
      userIDs.push(loginUser.userId);
    }

    // Use the $lookup aggregation pipeline to fetch matched bets along with user information and related events
    const matchedBets = await Bets.aggregate([
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
          bettor: '$userDetails.userName',
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
    const relatedEvents  = await Events.find({
      sportId: eventId.sportId,
      openDate: {
        $gt: eventId.openDate
      }
    }).limit(5)

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

const liveSportScore = async (eventId) => {
  try {
    const event = await Events.findOne({ Id: eventId }, { _id: 0, matchType: 1, sportsId: 1 });
    const type = event ? event.sportsId : null;
    console.log("event", event);
    let score = {};

    if(type == "4"){
      score = await cricketLiveScore(eventId)
    }else{
      return {
        status: false,
        message: "Figure batting not Allowed !"
      }
    }
    return {
        success: true,
        message: 'Live Score',
        score: score
    };
  }
  catch (error) {
      console.error(error);
      return {
          success: false,
          message: 'Failed to get data',
          error: error.message,
      };
  }
}

async function cricketLiveScore(id) {
    try {
      const apiResponse =  await   axios.get(`https://livesportscore.xyz:3440/api/bf_scores/${id}`);
      const data = apiResponse.data;
      const response = {};
      if(typeof(data[0]) == "string"){

        const event = await Events.findOne({ Id: id }, { _id: 0, matchType: 1, sportsId: 1 });
        const type          = event ? event.matchType : null;
        const scoreInfo     = JSON.parse(data).score
        let score           = 0;
        let inning          = 1;
        if(scoreInfo.activenation1 == 1){
          score  = scoreInfo.score1;
          played = scoreInfo.score2;
        }
        else if(scoreInfo.activenation2 == 1){
            score   = scoreInfo.score2;
            played  = scoreInfo.score1;
        }

        if(type == "TEST"){
          score = score.split('&');
          score = score[score.length - 1].trim()
          played = played.split('&');
          played = played[played.length - 1].trim();
        }
        played = played?.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
        played = played.filter(element => element != 0).length;
        if(played > 0){
          response.inning  = 2;

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

module.exports = { loginRouter, getParents };
