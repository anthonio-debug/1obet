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
const currentPosition = require('../models/CurrentPosition')

async function getParents(userId) {
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

async function getUsers(userIds) {

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
      console.log("inside of current position" );
      const position = new currentPosition({
        userId: user.userId,
        amount: - (user.commission / 100) * winningAmount,
        matchId: matchId,
      })
      position.save();

      let CurrentPosition = await new CurrentPosition({
        userId: user.userId,
        description: "some transection name",
        amount: -(user.commission / 100) * winningAmount,
        betId: Id,
        matchId: matchId,
      });
      await CurrentPosition.save();

    }
  }
  
};


async function placeBet(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  try {
    if (req.decoded.login.role !== '5') {
      return res.status(401).send({ message: 'You are not allowed to bet' });
    }
    // Variable declarations 
    let match;
    let subMarketDetail;
    let runnerName;
    let matchName;
    let marketId;
    let market;
    let selectedOddsRate;
    const { selectionId, betAmount, betRate, matchId, subMarketName, type, oddsId  } = req.body;
    const userId = req.decoded.userId;
    const ratesArray = [];
    let ApiResponseOdds;
    let matchedIndex;
    let winningAmount = 0;
    let loosingAmount = 0;
    let remainingAmount = 0;

    // Innitial Checks 
    if( betAmount < config.betMinimumAmount) {
      return res.status(404).send({ message: `minimum bet should be ${config.betMinimumAmount} ` });
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
    const parentUserIds = await getParents(user.userId);
    const marketIds = await User.distinct("blockedMarketPlaces",          { userId :{ $in: parentUserIds}, isDeleted:false });
    const subMarketId1 = await User.distinct("blockedSubMarkets",         { userId :{ $in: parentUserIds },isDeleted:false });
    const subMarketId2 = await User.distinct("blockedSubMarketsByParent", { userId :{ $in: parentUserIds }, isDeleted:false });
    const subMarketId = subMarketId1.concat(subMarketId2)
    const eventDetail   = await Events.findById(matchId);
    marketId = eventDetail.sportsId;
    market = eventDetail.marketIds[0];


    // Checks for Market Places & Sub Markets  
    if (marketId == '7' || marketId == '4339'){
      subMarketDetail = await SubMarketType.findOne({ countryCode: subMarketName, marketId: marketId }).exec();
      if (!subMarketDetail) {
        return res.status(404).send({ message: 'Bet not allowed' });
      }
    }else {
      subMarketDetail = await SubMarketType.findOne({ name: subMarketName, marketId: marketId }).exec();
      if (!subMarketDetail) {
        return res.status(404).send({ message: 'you cannot place bet' });
      }
    }

    if (marketIds.some((id)=> id == marketId) || subMarketId.some((id)=>id == subMarketDetail.subMarketId) ){
      return res.status(404).send({ message: 'Betting disabled' });
    }  
    if (user.betLockStatus == true || user.blockedSubMarketsByParent.some((id)=> id == subMarketDetail.subMarketId)) {
      return res.status(400).send({ message: 'Betting disabled' });
    }
    const userMaxBetSize = await userBetSizes.findOne({ userId: userId, sportsId: marketId }).exec();
    if (userMaxBetSize  && userMaxBetSize.amount < betAmount){
      return res.status(404).send({ message: `max bet size is : ${userMaxBetSize.amount}` });
    }

    if (marketId != '7' && marketId != '4339' && subMarketDetail.subMarketId != '104' && subMarketDetail.subMarketId != '128'){
      const url = `${config.sportsAPIUrl}/odds/?ids=${market}`;
      const response = await axios.get(url);
      const oddsData = response.data;
      if (!oddsData) {
        console.log(`Match odds not found for sports ID ${sportsId}`);
        return res.status(404).send({ message: `Bet mis match` });
      }

      // console.log('data', oddsData[0].Runners);

      const runnerFromAPI = oddsData[0].Runners.find(runner => runner.SelectionId == selectionId);
      // console.log('matchOdds.runners', runnerFromAPI);
      // console.log('selection Id', selectionId);
      
      if (type == 0){

        ApiResponseOdds         = runnerFromAPI.ExchangePrices.AvailableToBack
        console.log("ApiResponseOdds AvailableToBack === ", ApiResponseOdds);
        const DBOddDetails      = await Odds.findById(oddsId);
        console.log("DBOddDetails === ", DBOddDetails);
        const OddDetailsTeam    = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
        const availableToBack   = OddDetailsTeam.ExchangePrices.AvailableToBack;
        // console.log('availableToBack', availableToBack);
        matchedIndex = availableToBack.findIndex((back) => {
          return back.price === betRate;
        });
        console.log('matchedIndex', matchedIndex);
        if (matchedIndex == -1) {
          console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
          return res.status(404).send({ message: `No availableToBack odds matched with the bet rate ${req.body.betRate}` });
        }
        selectedOddsRate = availableToBack[matchedIndex].price;

      } else if (type == 1){
        ApiResponseOdds         = runnerFromAPI.ExchangePrices.AvailableToLay
        console.log("ApiResponseOdds AvailableToLay === ", ApiResponseOdds);
        const DBOddDetails      = await Odds.findById(oddsId);
        const OddDetailsTeam    = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
        const AvailableToLay    = OddDetailsTeam.ExchangePrices.AvailableToLay;
        console.log('AvailableToLay', AvailableToLay);
        matchedIndex = AvailableToLay.findIndex((back) => {
          return back.price === betRate;
        });
        console.log('matchedIndex', matchedIndex);
        if (!matchedIndex) {
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

    if (marketId == '7' || marketId == '4339'){

      console.log("MarketId ========== ", market);
      const url = `${config.horseRaceUrl}/odds/?ids=${market}`;
      const response = await axios.get(url);
      const oddsData = response.data;
      
      console.log("oddsData Runners ====== ", oddsData);
      if (oddsData.length == 0) {
        console.log(`Match odds not found for sports ID ${sportsId}`);
        return res.status(404).send({ message: `Bet mis match` });
      }

      console.log('data', oddsData[0]?.runners);


      const runnerFromAPI = oddsData[0]?.runners?.find(runner => runner.SelectionId == selectionId);
      console.log('matchOdds.runners', runnerFromAPI);
      
      if (type == 0){
        ApiResponseOdds         = runnerFromAPI.exchange.AvailableToBack
        console.log("ApiResponseOdds AvailableToBack === ", ApiResponseOdds);
        const DBOddDetails      = await RaceOdds.findById(oddsId);
        console.log("DBOddDetails === ", DBOddDetails);
        const OddDetailsTeam    = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
        const availableToBack   = OddDetailsTeam.exchange.AvailableToBack;
        // console.log('availableToBack', availableToBack);
        matchedIndex = availableToBack.findIndex((back) => {
          return back.price === betRate;
        });
        console.log('matchedIndex', matchedIndex);
        if (matchedIndex == -1) {
          console.log(`No availableToBack odds matched with the bet rate ${betRate}`);
          return res.status(404).send({ message: `No availableToBack odds matched with the bet rate ${req.body.betRate}` });
        }
        selectedOddsRate = availableToBack[matchedIndex].price;

      } else if (type == 1){
        ApiResponseOdds         = runnerFromAPI.exchange.AvailableToLay
        console.log("ApiResponseOdds AvailableToLay ====== ", ApiResponseOdds);
        const DBOddDetails      = await RaceOdds.findById(oddsId);
        const OddDetailsTeam    = DBOddDetails.runners.find(runner => runner.SelectionId == selectionId);
        const AvailableToLay    = OddDetailsTeam.exchange.AvailableToLay;
        console.log('AvailableToLay', AvailableToLay);
        matchedIndex = AvailableToLay.findIndex((back) => {
          return back.price === betRate;
        });
        console.log('matchedIndex', matchedIndex);
        if (!matchedIndex) {
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

    // if (marketId == '7' || marketId == '4339') {
    //   console.log('in horse race greyhound event');

    //   const GHRmarketId = await Events.distinct('marketIds', {
    //     sportsId: marketId,
    //     _id: matchId,
    //   });

    //   if (!GHRmarketId) {
    //     console.log(` race Match not found for sports ID ${marketId}`);
    //     return res.status(404).send({ message: `Bet miss matched` });
    //   }

    //   console.log('GHRmarketId', GHRmarketId);

    //   const url = `${config.horseRaceUrl}/odds/?ids=${GHRmarketId}`;
    //   const response = await axios.get(url);
    //   const HRGOdds = response.data;
    //   console.log('HRGOdds', HRGOdds);
    //   console.log('HRGRunners', HRGOdds[0].runners);

    //   // Find the runner in the HRGOdds object that matches the selectionId from the payload
    //   const selectedRunner = HRGOdds[0].runners.find(runner => runner.selectionId == req.body.selectionId);
    //   console.log('selectedRunner', selectedRunner);

    //   if (!selectedRunner) {
    //     console.log(`Runner not found for selectionId ${req.body.selectionId}`);
    //     return res.status(404).send({ message: 'Runner not found' });
    //   }

    //   // Get the corresponding available prices based on the type (0 for availableToBack, 1 for availableToLay)
    //   let availablePrices;
    //   if (req.body.type === 0) {
    //     availablePrices = selectedRunner.exchange.availableToBack;
    //     console.log('availablePrices', availablePrices);
    //   } else if (req.body.type == 1) {
    //     availablePrices = selectedRunner.exchange.availableToLay;
    //   } else {
    //     console.log('Invalid type value. Type should be 0 or 1.');
    //     return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
    //   }
    //   if (availablePrices === null) {
    //     return res.status(404).send({ message: 'price cannot be null' })
    //   }
    //   // Find the matched price in the available prices
    //   const matchedPrice = availablePrices.find(price => price.price === req.body.betRate);

    //   if (!matchedPrice) {
    //     console.log(`No odds matched with the bet rate ${req.body.betRate}`);
    //     return res.status(404).send({ message: `No odds matched with the bet rate ${req.body.betRate}` });
    //   }

    //   // Now you have the selectedOddsRate based on the selected team and type
    //   const selectedOddsRate = matchedPrice.price;
    //   // Now you have the selectedOddsRate based on the selected team and type
    //   console.log('Selected Odds:', selectedOddsRate);
    // }
    //for fancy
    // if (subMarketDetail.subMarketId == '104' && marketId == '4' ) {
    //   const eventId = match.Id
    //   const url = `${config.fancyUrl}/bm_fancy/${eventId}`;
    //   const response = await axios.get(url);
    //   const fancyOdds = response?.data.data;
    //   // console.log('fancyOdds',fancyOdds);
    //   console.log('fancyOddst3', fancyOdds?.t3);
    //   if (fancyOdds){
    //     const selectedTeamOdds = fancyOdds.t3.find(runner => runner.sid == req.body.selectionId);
    //     console.log('selectedTeamOdds', selectedTeamOdds);
    //     if (!selectedTeamOdds) {
    //       console.log(`Odds not available for the selected team ${req.body.selectionId}`);
    //       return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
    //     }
    //     runnerName = selectedTeamOdds.nat; // Get the runner name from the 'nat' field

    //     let selectedOddsRate = null;

    //     if (req.body.type === 0) {
    //       // If type is 0 (available to back), try to find a match between the user-provided betRate and any of the available back odds (b1, b2, or b3)
    //       const backOdds = [selectedTeamOdds.b1, selectedTeamOdds.b2, selectedTeamOdds.b3];
    //       console.log('backOdds', backOdds)
    //       selectedOddsRate = backOdds.find(back => back == req.body.betRate);
    //     } else if (req.body.type === 1) {
    //       const layOdds = [selectedTeamOdds.l1, selectedTeamOdds.l2, selectedTeamOdds.l3];
    //       console.log('layOdds', layOdds);
    //       selectedOddsRate = layOdds.find(lay => lay == req.body.betRate)
    //     }
    //     else {
    //       console.log('Invalid type value. Type should be 0 or 1.');
    //       return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
    //     }

    //     if (!selectedOddsRate || selectedOddsRate == '0.00') {
    //       // If odds are not available or suspended.
    //       console.log(`Selected odds for the bet are not available or suspended for the team ${req.body.selectionId}`);
    //       return res.status(404).send({ message: `Selected odds for the bet are not available or suspended for the team ${req.body.selectionId}` });
    //     }
    //     // Now you have the selectedOddsRate based on the selected team and type
    //     console.log('Selected Odds:', selectedOddsRate);
    //   }

    // }
   
    // // for bookmaker
    // if (subMarketDetail.subMarketId === '128' && marketId === '4') {
    //   console.log('in bookmakrer');
    //   const eventId = match.Id
    //   const url = `${config.fancyUrl}/bm_fancy/${eventId}`;
    //   const response = await axios.get(url);
    //   const bookMakerOdds = response?.data.data;
    //   console.log('bookMakerOdds', bookMakerOdds.t2[0]);
    //   // const bookMakerOdds = await FancyGames.find({
    //   //   eventTypeId: sportsId,
    //   //   eventId: match.Id,
    //   //   createdAt: selectedTime,
    //   // });
    //   console.log('bookMakerOdds====>', bookMakerOdds.t2[0].bm1);
    //   if (bookMakerOdds) {
    //     // Extract the odds data for the selected team from the "t3" array
    //     const selectedTeamOdds = bookMakerOdds.t2[0].bm1.find(runner => runner.sid == selectionId);

    //     if (!selectedTeamOdds) {
    //       console.log(`Odds not available for the selected team ${req.body.selectionId}`);
    //       return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
    //     }
    //     console.log('selectedTeamOdds', selectedTeamOdds);
    //     runnerName = selectedTeamOdds.nat //runnername

    //     let selectedOddsRate = null;
    //     if (req.body.type === 0) {
    //       // If type is 0 (available to back), try to find a match between the user-provided betRate and any of the available back odds (b1, b2, or b3)
    //       const backOdds = [selectedTeamOdds.b1, selectedTeamOdds.b2, selectedTeamOdds.b3];
    //       console.log('backOdds', backOdds);
    //       selectedOddsRate = backOdds.find(back => back == req.body.betRate);
    //     } else if (req.body.type === 1) {
    //       // If type is 1 (available to lay), use the "l1", "l2", or "l3" price for the lay odds
    //       const layOdds = [selectedTeamOdds.l1, selectedTeamOdds.l2, selectedTeamOdds.l3];
    //       selectedOddsRate = layOdds.find(lay => lay == req.body.betRate)
    //     }
    //     else {
    //       console.log('Invalid type value. Type should be 0 or 1.');
    //       return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
    //     }

    //     if (!selectedOddsRate || selectedOddsRate == '0.00') {
    //       // If odds are not available or suspended.
    //       console.log(`Selected odds for the bet are not available or suspended for the team ${req.body.selectionId}`);
    //       return res.status(404).send({ message: `Selected odds for the bet are not available or suspended for the team ${req.body.selectionId}` });
    //     }
    //     // Now you have the selectedOddsRate based on the selected team and type
    //     console.log('Selected Odds:', selectedOddsRate);
    //   }
    // }
    
    if (type == 0){
      winningAmount = ( betAmount * betRate ) - betAmount;
      loosingAmount = betAmount;
    } else {
      winningAmount = betAmount;
      loosingAmount = (betAmount * betRate) - betAmount;
    }
    
    const bet = new Bets({
      marketId,
      userId,
      betAmount,
      betRate,
      matchId: matchId,
      loosingAmount: loosingAmount,
      winningAmount: winningAmount,
      subMarketId: subMarketDetail.subMarketId,
      event: matchName,
      runner: selectionId,
      type: type
    });

    bet.save(async (err, result) => {
      if (err) {
        console.log('err', err);
        return res.status(404).send({ message: 'Error placing bet' });
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
        console.log("parentUserIds ===========", parentUserIds);
        console.log("winningAmount ===========", winningAmount);
        console.log("matchId =================", matchId);


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

function getUserBets(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
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
  if (req.body.sort) {
    sort = Number(req.body.sort);
  }
  if (req.body.page) {
    page = Number(req.body.page);
  }
  if (req.body.startDate && req.body.endDate) {
    const startTimestamp = new Date(req.body.startDate).getTime() / 1000;
    const endTimestamp = new Date(req.body.endDate).getTime() / 1000;
    query.createdAt = {
      $gte: startTimestamp,
      $lte: endTimestamp,
    };
  }

  if (req.decoded.role !== '5') {
    query.userId = req.body.userId;
  } else if (req.decoded.role == '5') {
    query.userId = req.decoded.userId;
  }

  if (req.body.status) {
    query.status = req.body.status;
  }
  if (req.body.marketId) {
    query.marketId = req.body.marketId;
  }
  if (req.body.searchValue) {
    const searchRegex = new RegExp(req.body.searchValue, 'i');
    query.$or = [
      { name: { $regex: searchRegex } },
      {
        $expr: {
          $regexMatch: { input: { $toString: '$betRate' }, regex: searchRegex },
        },
      },
      {
        $expr: {
          $regexMatch: {
            input: { $toString: '$betAmount' },
            regex: searchRegex,
          },
        },
      },
    ];
  }

  User.findOne({ userId: query.userId }, (err, user) => {
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

    if (loginUser.role === '5') {
      userIDs.push(loginUser.userId);
    }

    // Use the $lookup aggregation pipeline to fetch matched bets along with user information and related events
    const matchedBets = await Bets.aggregate([
      { $match: { userId: { $in: [...createdByIDs, ...userIDs, loginUser.userId] }, status: 1 } },
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

    return res.send({
      success: true,
      message: 'Matched bets record found',
      data: matchedBets
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
