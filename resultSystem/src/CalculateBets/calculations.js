require('dotenv').config();
const Bets = require('../../../app/models/bets');
const expPositive = require("../../../app/models/ExpPositive");
const User = require('../../../app/models/user');
const { getParents } = require('../../../app/routes/bets');
const Events = require('../../../app/models/events');
const Deposits = require('../../../app/models/deposits');
const CurrentPosition = require('../../../app/models/CurrentPosition');
const CurrentPosition2 = require('../../../app/models/CurrentPosition2');
const RunnerWiselossShares = require('../../../app/models/RunnerWiselossShares');
const MarketIDS = require('../../../app/models/marketIds');
const Sessions = require('../../../app/models/Session');
const ExpRec = require('../../../app/models/ExpRec');
const { CALC_FANCY_URI, CALC_LIVE_BET_TV_URI } = require('../../../app/global/constants');

const config = {
  apisFileName: 'config/settings/apis/allApis.json',
  saltRounds: 10,
  pageSize: 10,
  staging_apiUrl: 'https://stage.game-program.com/api/seamless/provider',
  apiUrl: 'https://em-api.thegameprovider.com/api/seamless/provider',
  eventListAPIUrl: 'https://tvlivestreaming.online:3440/api',
  sportsAPIUrl: 'http://209.250.242.175:33332',
  fancyUrl: CALC_FANCY_URI,
  liveTvUrl: 'https://livesportscore.xyz:3440/api',
  liveBetTvUrl: CALC_LIVE_BET_TV_URI,
  liveScoreUrl: 'https://livesportscore.xyz:3443/api/getScoreId',
  roundResultUrl: 'http://103.228.112.83:8997',
  sportsLiveScore: 'https://livesportscore.xyz:3440/api/bf_scores/',
  horseRaceUrl: 'http://136.244.77.249:33333',
  worldCasinoOnlineAuthUrl: 'https://stageapiauth.worldcasinoonline.com/api/auth/userauthentication',
  worldCasinoOnlineApiUrl: 'https://stageapi.worldcasinoonline.com/api',
  oldSaltKey: 'Loa0192Jua',
  betMinimumAmount: 100,
  language: 'en',
  play_for_fun: false,
  currency: 'PKR',
  createCasinoUser: true,
  casinoMultiples: 10,
  commission: 2,
  SportOddsSubMarkets: [6, 13, 15],
  sportMarkets: ['1', '2', '4'],
  raceMarkets: ['7', '4339'],
  casinoMarketId: '6',
  FigureEvenOddSmallBig: [9, 10, 34],
  asianSubMarket: [36, 37, 38, 39, 40, 41, 42, 43, 44],
  commissionLessSubMarkets: [2, 3, 4],
  balls: ['1', '2', '3', '4', '5', '6'],
  matchTypes: ['T10', 'T20', 'ODI', 'TEST'],
  ExcludedBackLay: [7, 8],
  soccerOdds: 13,
  tennisOdds: 15,
  cricketOdds: 6,
  Fancy: 7,
  BookMaker: 8,
  Figure: 9,
  EvenOdd: 10,
  SmallBig: 34,
  Toss: 11,
  Cup: 12,
  tiedMatch: 35,
  overUnder: 14,
  raceOpenBefore: 180000,
  sportsOpenBefore: 600000,
  tossCloseTime: 2700000
};

async function getEndedMatches(sportsId) {
  try {
    const endedMatches = await Events.find({
      sportsId,
      winner: { $ne: 0 },
      betSettled: false
    });
    return endedMatches;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function getAllBets(Id) {
  try {
    const allBets = await Bets.find({ matchId: Id, status: 1 });
    return allBets;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function handleLosingBet(bet) {
  return;
  console.log("I am LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoswer");
  console.log("I am LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoswer");
  console.log("I am LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoswer");
  console.log("I am LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoswer");
  console.log("I am LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoswer");
  console.log("I am LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoswer");
  console.log("I am LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoswer");
  console.log("I am LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoswer");
  console.log("I am LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoswer");
  console.log("I am LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoswer");
  
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  try {
    if (bet.status == 1) {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const userId = bet.userId;
        const loosingAmount = Number(bet.loosingAmount);
        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });
        if (!userToUpdate) {
          console.error('Error: User Not Found Location:(_handle losing bet)');
          return;
        } else {
          const exists = await Deposits.findOne({
            userId: userToUpdate.userId,
            betId: bet._id,
            amount: -loosingAmount,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          });
          if (exists) {
            
            // await Bets.updateOne(
            //   { _id: bet._id },
            //   {
            //     status: 0,
            //     updatedAt: new Date().getTime()
            //   }
            // );
            // await CurrentPosition.deleteMany({ betId: betIdString });
            return;
          }
          const user_prev_balance = userToUpdate.balance;
          const user_prev_availableBalance = userToUpdate.availableBalance;
          const user_prev_exposure = userToUpdate.exposure;

          const updatedBalance = Number((userToUpdate.balance - loosingAmount));
          const updatedClientPL = Number((userToUpdate.clientPL - loosingAmount));
          let userToUpdateAvailableBalance = -loosingAmount;
          let addExposureAmount = 0;
          if (bet.calculateExp === true) {
            userToUpdateAvailableBalance = Number((userToUpdateAvailableBalance + Number(bet.exposureAmount)));
            addExposureAmount = Number(bet.exposureAmount);
            calculatedExp = 1;
          }
          const expAmount = Number((userToUpdate.exposure + addExposureAmount));
          const updatedAvailableBalance = Number(userToUpdate.availableBalance + Number(userToUpdateAvailableBalance));
          await User.updateOne(
            {
              userId: userId,
              isDeleted: false
            },
            {
              balance: updatedBalance,
              clientPL: updatedClientPL,
              exposure: expAmount,
              availableBalance: updatedAvailableBalance
            }
          );
          const lastMaxWithdraw = await Deposits.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });
          await Deposits.create({
            userId: userToUpdate.userId,
            description: `Event (${bet.event}) Runner (${bet.runnerName})`,
            amount: -loosingAmount,
            balance: lastMaxWithdraw ? lastMaxWithdraw.balance - loosingAmount : -loosingAmount,
            availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - loosingAmount : -loosingAmount,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - loosingAmount : loosingAmount,
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            createdBy: 0,
            cashOrCredit: 'Bet',
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId,
            betId: bet._id.toString(),
            betType: bet.type,
            betDateTime: bet.betTime,
            date: new Date().getTime(),
            createdAt: formattedDate,
            betSession: bet.betSession,
            roundId: bet.roundId,
            addedExpoisureAmount: addExposureAmount,
            UserPrevexposure: userToUpdate.exposure,
            UpdatedExposure: expAmount,
       

            

            

            calculateExp:bet.calculateExp,
            
          });
          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: { $in: parentUserIds },
            isDeleted: false
          }).sort({ userId: -1 });
          if (!parentUser) {
            console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
            return;
          } else {
            const remainingAmount = Number(bet.winningAmount);
            const TotalLoosingAmount = Number(bet.loosingAmount);
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            let commissionFrom = userToUpdate.userId;
            let upMovingAmount = TotalLoosingAmount;
            for (const user of parentUser) {
              const totalExpoisure = Number((user.exposure + Number(((user.commission / 100) * remainingAmount))));
              const totalavailableBalance = Number((user.availableBalance + Number(((user.commission / 100) * remainingAmount + (user.commission / 100) * TotalLoosingAmount))));
              const totalBalance = Number((user.balance + Number(((user.commission / 100) * TotalLoosingAmount))));
              const totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * TotalLoosingAmount)) : 0;
              const totalClientPL = Number((user.clientPL - totalClientPLAmount));
              
              await User.updateOne(
                {
                  _id: user?._id
                },
                {
                  balance: totalBalance,
                  clientPL: totalClientPL,
                  exposure: totalExpoisure,
                  availableBalance: totalavailableBalance
                }
              );

              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });

              await Deposits.create({
                userId: user.userId,
                description: `Paid to Battor for  Event (${bet.event}) Runner (${bet.runnerName})`,
                createdBy: 0,
                amount: (user.commission / 100) * TotalLoosingAmount,
                balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
                availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
                maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
                commissionFrom: commissionFrom,
                cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
                credit: lastMaxWithdraw ? lastMaxWithdraw.credit : 0,
                creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining : 0,
                cashOrCredit: 'Bet',
                marketId: bet.marketId,
                sportsId: bet.sportsId,
                upLineAmount: upMovingAmount,
                betId: bet._id.toString(),
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
                betSession: bet.betSession,
                roundId: bet.roundId,
                addedExpoisureAmount: Number(((user.commission / 100) * remainingAmount)),
                UserPrevexposure: user.exposure,
                UpdatedExposure: totalExpoisure,
                exposure: 'Number(((user.commission / 100) * remainingAmount))',
     
              });

              upMovingAmount = Number((upMovingAmount - Number(((user.commission / 100) * TotalLoosingAmount))));
              commissionFrom = user.userId;
            }

            let winnerRunnerData = 0;
            let SessionScore = 0;

            if (bet.isfancyOrbookmaker && bet.fancyData != null) {
              const marketInfo = await MarketIDS.findOne({
                sportID: bet.sportsId,
                marketId: bet.marketId
              });
              winnerRunnerData = marketInfo?.winnerRunnerData;
            } else if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
              const match = await Events.findById(bet.matchId);
              const marketInfo = await Sessions.findOne({
                eventId: Number(match.Id),
                sessionNo: bet.betSession
              });
              SessionScore = marketInfo?.score;
            }
            await Bets.updateOne(
              {
                _id: bet._id
              },
              {
                status: 0,
                position: bet.loosingAmount * -1,
                iscalculatedExp: calculatedExp,
                winnerRunnerData: winnerRunnerData,
                SessionScore: SessionScore,
                updatedAt: new Date().getTime()
              }
            );
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ betId: betIdString });
            const updatedUser = await User.findOne({
              userId: userId,
              isDeleted: false
            });
            if (bet.calculateExp) {
              await ExpRec.create({
                userId: updatedUser.userId,
                trans_from: 'BetLose',
                trans_from_id: bet._id,
                trans_bet_status: 0,
                user_prev_balance: user_prev_balance,
                user_prev_availableBalance: user_prev_availableBalance,
                user_prev_exposure: user_prev_exposure,
                user_new_balance: updatedBalance,
                user_new_availableBalance: updatedAvailableBalance,
                user_new_exposure: expAmount,
                marketId: bet.marketId,
                sportsId: bet.sportsId,
                calculatedExp: calculatedExp,
                DateTime: new Date(),
                calculateExp: calculatedExp,
                position: bet.position,
                exposureAmount: bet.exposureAmount,
                betSession: bet.betSession,
                roundId: bet.roundId
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error: Handle Losing Bet ', error);
    return;
  }
}

async function handleWinningBet(bet, winner) {
  return;
  console.log("I am OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOWinner");
  console.log("I am OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOWinner");
  console.log("I am OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOWinner");
  console.log("I am OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOWinner");
  console.log("I am OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOWinner");
  console.log("I am OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOWinner");
  console.log("I am OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOWinner");
  console.log("I am OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOWinner");
  console.log("I am OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOWinner");
  console.log("I am OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOWinner");

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  try {
    if (bet.status == 1) {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const userId = bet.userId;
        let TotalWin = 0;
        let TotalLose = 0;
        if (Number(bet.sportsId) != 8) {
          const winnings = await Bets.find(
            {
              sportsId: bet.sportsId,
              marketId: bet.marketId,
              matchId: bet.matchId,
              userId: bet.userId,
              subMarketId: { $ne: '7' },
              $or: [
                { type: 0, runner: winner },
                { type: 1, runner: { $ne: winner } }
              ]
            },
            { winningAmount: 1, _id: 0 }
          );
          const loosings = await Bets.find(
            {
              sportsId: bet.sportsId,
              marketId: bet.marketId,
              matchId: bet.matchId,
              userId: bet.userId,
              subMarketId: { $ne: '7' },
              $or: [
                { type: 1, runner: winner },
                { type: 0, runner: { $ne: winner } }
              ]
            },
            { loosingAmount: 1, _id: 0 }
          );

          for (const singleWin of winnings) {
            TotalWin = Number((TotalWin + singleWin.winningAmount));
          }

          for (const singleLose of loosings) {
            TotalLose = Number((TotalLose + singleLose.loosingAmount));
          }
        }

        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });

        if (!userToUpdate) {
          console.error('Error: user not found Location:(_handle winning bet)');
          return;
        } else {
          
          const mongoose = require('mongoose');
          const session = await mongoose.startSession();
          const maxRetries = 3; // Max retries for the transaction
          session.startTransaction();
          let remainingAmount;
          let commissionAmount;
          let totalRemainingAmount;
          let TotalLoosingAmount;
          let upMovingAmount;
          let upMovingCommAmount;
          if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker && (TotalWin > TotalLose || Number(bet.sportsId) == 8)) {
            const absouteWin = Number((TotalWin - TotalLose));
            const totalCooission = Number((absouteWin * 0.02));
            commissionAmount = Number(((totalCooission / TotalWin) * bet.winningAmount));
            if (Number(bet.sportsId) == 8) commissionAmount = Number((bet.winningAmount * 0.02));
            remainingAmount = Number((bet.winningAmount - commissionAmount));
            totalRemainingAmount = Number(bet.winningAmount);
            TotalLoosingAmount = Number(bet.loosingAmount);
            upMovingAmount = totalRemainingAmount;
            upMovingCommAmount = commissionAmount;
          } else {
            remainingAmount = Number(bet.winningAmount);
            commissionAmount = 0;
            totalRemainingAmount = Number(bet.winningAmount);
            TotalLoosingAmount = Number(bet.loosingAmount);
            upMovingAmount = totalRemainingAmount;
            upMovingCommAmount = commissionAmount;
          }

          const user_prev_balance = userToUpdate.balance;
          const user_prev_availableBalance = userToUpdate.availableBalance;
          const user_prev_exposure = userToUpdate.exposure;

          const UpdatedBalance = Number((userToUpdate.balance + remainingAmount));
          const UpdatedclientPL = Number((userToUpdate.clientPL + remainingAmount));
          let userToUpdateAvailableBalance = remainingAmount;
          let addExposureAmount = 0;
          if (bet.calculateExp) {
            userToUpdateAvailableBalance = Number((userToUpdateAvailableBalance + Number(bet.exposureAmount)));
            addExposureAmount = Number(bet.exposureAmount);
            calculatedExp = 1;
          }
          const UpdatedExposure = Number((userToUpdate.exposure + addExposureAmount));
          const UpdatedAvailableBalance = Number((userToUpdate.availableBalance + Number(userToUpdateAvailableBalance)));
          const exists = await Deposits.findOne({
            userId: userToUpdate.userId,
            betId: bet._id,
            amount: remainingAmount,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          }).session(session);
          if (exists) {
            console.log('=====================handleWinningBet exists=====================');
            console.log(bet._id, bet.status);
            console.log('=====================handleWinningBet exists=====================');
            // await Bets.updateOne(
            //   { _id: bet._id },
            //   {
            //     status: 0,
            //     updatedAt: new Date().getTime()
            //   }
            // );
            // await CurrentPosition.deleteMany({ betId: betIdString });
            return;
          }
          await User.updateOne(
            {
              userId: userId,
              isDeleted: false
            },
            {
              balance: UpdatedBalance,
              clientPL: UpdatedclientPL,
              exposure: UpdatedExposure,
              availableBalance: UpdatedAvailableBalance
            }
          );
          const lastMaxWithdraw = await Deposits.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });

          await Deposits.create({
            userId: userToUpdate.userId,
            description: `Event (${bet.event}) Runner (${bet.runnerName})`,
            betId: bet._id.toString(),
            createdBy: 0,
            amount: remainingAmount,
            balance: lastMaxWithdraw ? lastMaxWithdraw.balance + remainingAmount : remainingAmount,
            availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + remainingAmount : remainingAmount,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + remainingAmount : remainingAmount,
            cashOrCredit: 'Bet',
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId,
            betType: bet.type,
            betDateTime: bet.betTime,
            date: new Date().getTime(),
            createdAt: formattedDate,
            betSession: bet.betSession,
            roundId: bet.roundId,
            addedExpoisureAmount: addExposureAmount,
            UserPrevexposure: userToUpdate.exposure,
            UpdatedExposure: UpdatedExposure,
       

  
          
            calculateExp:bet.calculateExp,
       
          });
          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: {
              $in: [...parentUserIds]
            },
            isDeleted: false
          }).sort({ userId: -1 });
          if (!parentUser) {
            console.error(' Error: Parent Users Not Found Location:(_handle Winning  bet) ');
            return;
          } else {
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            let commissionFrom = userToUpdate.userId;
            for (const user of parentUser) {
              const totalExpoisure = Number((user.exposure + Number(((user.commission / 100) * totalRemainingAmount))));
              const totalBalance = Number((user.balance - Number(((user.commission / 100) * remainingAmount))));
              const totalavailableBalance = Number((user.availableBalance + Number(((user.commission / 100) * commissionAmount))));
              const totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount)) : 0;
              const totalClientPL = Number((user.clientPL + totalClientPLAmount));
              await User.updateOne(
                {
                  userId: user.userId,
                  isDeleted: false
                },
                {
                  balance: totalBalance,
                  exposure: totalExpoisure,
                  availableBalance: totalavailableBalance,
                  clientPL: totalClientPL
                }
              );

              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
              await Deposits.create({
                userId: user.userId,
                description: `Event (${bet.event}) Runner (${bet.runnerName})`,
                createdBy: 0,
                amount: -(user.commission / 100) * totalRemainingAmount,
                balance: lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
                marketId: bet.marketId,
                credit: lastMaxWithdraw?.credit || 0,
                creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
                cashOrCredit: 'Bet',
                commissionFrom: commissionFrom,
                sportsId: bet.sportsId,
                upLineAmount: -upMovingAmount,
                betId: bet._id.toString(),
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
                totalRemainingAmount: totalRemainingAmount,
                commissionAmount: commissionAmount,
                remainingAmount: remainingAmount,
                betSession: bet.betSession,
                roundId: bet.roundId,

                addedExpoisureAmount: Number(((user.commission / 100) * totalRemainingAmount)),
                UserPrevexposure: user.exposure,
                UpdatedExposure: totalExpoisure,
                exposure: 'Number(((user.commission / 100) * totalRemainingAmount))',
    
              });
              upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount));

              if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker && TotalWin > TotalLose) {
                const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });

                await Deposits.create({
                  userId: user.userId,
                  description: `Commission From Event (${bet.event}) Runner (${bet.runnerName})`,
                  createdBy: 0,
                  commissionFrom: commissionFrom,
                  amount: (user.commission / 100) * commissionAmount,
                  balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                  availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                  maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                  cashOrCredit: 'Commission',
                  betId: bet._id.toString(),
                  cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
                  marketId: bet.marketId,
                  sportsId: bet.sportsId,
                  credit: lastMaxWithdraw?.credit || 0,
                  creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
                  upLineAmount: upMovingCommAmount,
                  matchId: bet.matchId,
                  betType: bet.type,
                  betDateTime: bet.betTime,
                  date: new Date().getTime(),
                  createdAt: formattedDate,
                  betSession: bet.betSession,
                  roundId: bet.roundId
                });

                upMovingCommAmount = Number((upMovingCommAmount - (user.commission / 100) * commissionAmount));
              }
              commissionFrom = user.userId;
            }

            let winnerRunnerData = 0;
            let SessionScore = 0;
            if (bet.isfancyOrbookmaker && bet.fancyData != null) {
              const marketInfo = await MarketIDS.findOne({
                sportID: bet.sportsId,
                marketId: bet.marketId
              });
              winnerRunnerData = marketInfo?.winnerRunnerData;
            } else if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
              const match = await Events.findById(bet.matchId);
              const marketInfo = await Sessions.findOne({
                eventId: Number(match.Id),
                sessionNo: bet.betSession
              });
              SessionScore = marketInfo?.score;
            }
            await Bets.updateOne(
              { _id: bet._id },
              {
                status: 0,
                position: Number(bet.winningAmount),
                iscalculatedExp: calculatedExp,
                winnerRunnerData: winnerRunnerData,
                SessionScore: SessionScore,
                updatedAt: new Date().getTime()
              }
            );
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ betId: betIdString });

            const updatedUser = await User.findOne({
              userId: userId,
              isDeleted: false
            });
            if (bet.calculateExp) {
              await ExpRec.create({
                userId: updatedUser.userId,
                trans_from: 'BetWin',
                trans_from_id: bet._id,
                trans_bet_status: 0,
                user_prev_balance: user_prev_balance,
                user_prev_availableBalance: user_prev_availableBalance,
                user_prev_exposure: user_prev_exposure,
                user_new_balance: UpdatedBalance,
                user_new_availableBalance: UpdatedAvailableBalance,
                user_new_exposure: UpdatedExposure,
                marketId: bet.marketId,
                sportsId: bet.sportsId,
                calculatedExp: calculatedExp,
                DateTime: new Date(),
                calculateExp: calculatedExp,
                position: bet.position,
                exposureAmount: bet.exposureAmount
              });
            }
          }
      
      
      
      
      
      
          await session.commitTransaction();
          //await session.abortTransaction();
          session.endSession();
        }
      
      
      
      
      
      }
    }
  } catch (error) {
    console.error(' Error: Handle Winning Bet ', error);
    return;
  }
}

const handleDrawBet = async (bet, status = 0) => {
  try {
    if (bet.status == 1) {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const totalRemainingAmount = Number(bet.winningAmount);
        const userId = bet.userId;
        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });
        if (!userToUpdate) {
          console.error('Error: User Not Found Location:(_handle draw bet)');
          return;
        } else {
          const user_prev_balance = userToUpdate.balance;
          const user_prev_availableBalance = userToUpdate.availableBalance;
          const user_prev_exposure = userToUpdate.exposure;

          const updatedUserAvlBalance = Number((userToUpdate.availableBalance + Number(bet.exposureAmount)));
          const updatedUserExp = Number((userToUpdate.exposure + Number(bet.exposureAmount)));

          
          if ((bet.isfancyOrbookmaker == true && bet.fancyData !== null) || [2, 3, 4].includes(bet.type)) {
            if (bet.calculateExp === true) {
              calculatedExp = 1;
              await User.updateOne(
                {
                  userId: userId,
                  isDeleted: false
                },
                {
                  availableBalance: updatedUserAvlBalance,
                  exposure: updatedUserExp
                }
              );
            }

          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: { $in: [...parentUserIds] },
            isDeleted: false
          }).sort({ role: -1 });
          if (!parentUser) {
            console.error(' Error : Parent User Not Found Location:(_handle Draw bet ) ');
            return;
          } else {
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            let winningsShareAmount;
            for (const user of parentUser) {
              winningsShareAmount = Number(((user.commission / 100) * totalRemainingAmount));
              console.log("--------winningsShareAmount--------------------",winningsShareAmount);
              const amountToBeAddedExp = Number((user.exposure + winningsShareAmount));
              console.log("--amountToBeAddedExp--------------------------",amountToBeAddedExp);
              const amountToBeAddedAvlBalance = Number((user.availableBalance + Number(((user.commission / 100) * totalRemainingAmount))));
              await User.updateOne(
                {
                  _id: user._id
                },
                {
                  exposure: amountToBeAddedExp,
                  availableBalance: amountToBeAddedAvlBalance
                }
              );
              
              console.log("fancy deleeting from current positions.............................");
              console.log("fancy deleeting from current positions.............................");
              console.log("fancy deleeting from current positions.............................");
              console.log("fancy deleeting from current positions.............................");
              console.log("fancy deleeting from current positions.............................");
              console.log("fancy deleeting from current positions.............................");
              console.log("fancy deleeting from current positions.............................");

              await CurrentPosition.deleteMany({ 
                userId: user.userId,
                betSession: bet.betSession,
                marketId: bet.marketId
    
    
              });



            }
            await Bets.updateOne(
              { _id: bet._id },
              {
                position: 0,
                status: status,
                iscalculatedExp: calculatedExp,
                updatedAt: new Date().getTime()
              }
            );
          
            await CurrentPosition.deleteMany({ userId:userId,
              betSession: bet.betSession,
              marketId: bet.marketId 
            });
            

            const updatedUser = await User.findOne({
              userId: userId,
              isDeleted: false
            });
            const user_new_balance = updatedUser.balance;
            if (bet.calculateExp) {
              await ExpRec.create({
                userId: updatedUser.userId,
                trans_from: 'BetDrawOrCanceled',
                trans_from_id: bet._id,
                trans_bet_status: status,
                user_prev_balance: user_prev_balance,
                user_prev_availableBalance: user_prev_availableBalance,
                user_prev_exposure: user_prev_exposure,
                user_new_balance: user_new_balance,
                user_new_availableBalance: updatedUserAvlBalance,
                user_new_exposure: updatedUserExp,
                marketId: bet.marketId,
                sportsId: bet.sportsId,
                calculatedExp: calculatedExp,
                DateTime: new Date(),
                calculateExp: calculatedExp,
                position: bet.position,
                exposureAmount: bet.exposureAmount
              });
            }
          }

        }

        }
      }
    }
  } catch (error) {
    console.error('Error: Draw Bet_', error);
    return;
  }
};
async function handleWinningBetX(bet, winner) {
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXWinner");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXWinner");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXWinner");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXWinner");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXWinner");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXWinner");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXWinner");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXWinner");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXWinner");

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;

  while (retries < maxRetries) {
  try {
    if (bet.status == 1) {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const userId = bet.userId;
        let TotalWin = 0;
        let TotalLose = 0;
        if (Number(bet.sportsId) != 8) {
          const winnings = await Bets.find(
            {
              sportsId: bet.sportsId,
              marketId: bet.marketId,
              matchId: bet.matchId,
              userId: bet.userId,
              subMarketId: { $ne: '7' },
              $or: [
                { type: 0, runner: winner },
                { type: 1, runner: { $ne: winner } }
              ]
            },
            { winningAmount: 1, _id: 0 }
          );
          const loosings = await Bets.find(
            {
              sportsId: bet.sportsId,
              marketId: bet.marketId,
              matchId: bet.matchId,
              userId: bet.userId,
              subMarketId: { $ne: '7' },
              $or: [
                { type: 1, runner: winner },
                { type: 0, runner: { $ne: winner } }
              ]
            },
            { loosingAmount: 1, _id: 0 }
          );

          for (const singleWin of winnings) {
            TotalWin = Number((TotalWin + singleWin.winningAmount));
          }

          for (const singleLose of loosings) {
            TotalLose = Number((TotalLose + singleLose.loosingAmount));
          }
        }

        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });

        if (!userToUpdate) {
          console.error('Error: user not found Location:(_handle winning bet)');
          return;
        } else {
          
          session.startTransaction();
          let remainingAmount;
          let commissionAmount;
          let totalRemainingAmount;
          let TotalLoosingAmount;
          let upMovingAmount;
          let upMovingCommAmount;
          if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker && (TotalWin > TotalLose || Number(bet.sportsId) == 8)) {
            const absouteWin = Number((TotalWin - TotalLose));
            const totalCooission = Number((absouteWin * 0.02));
            commissionAmount = Number(((totalCooission / TotalWin) * bet.winningAmount));
            if (Number(bet.sportsId) == 8) commissionAmount = Number((bet.winningAmount * 0.02));
            remainingAmount = Number((bet.winningAmount - commissionAmount));
            totalRemainingAmount = Number(bet.winningAmount);
            TotalLoosingAmount = Number(bet.loosingAmount);
            upMovingAmount = totalRemainingAmount;
            upMovingCommAmount = commissionAmount;
          } else {
            remainingAmount = Number(bet.winningAmount);
            commissionAmount = 0;
            totalRemainingAmount = Number(bet.winningAmount);
            TotalLoosingAmount = Number(bet.loosingAmount);
            upMovingAmount = totalRemainingAmount;
            upMovingCommAmount = commissionAmount;
          }

          const user_prev_balance = userToUpdate.balance;
          const user_prev_availableBalance = userToUpdate.availableBalance;
          const user_prev_exposure = userToUpdate.exposure;

          const UpdatedBalance = Number((userToUpdate.balance + remainingAmount));
          const UpdatedclientPL = Number((userToUpdate.clientPL + remainingAmount));
          let userToUpdateAvailableBalance = remainingAmount;
          let addExposureAmount = 0;
          if (bet.calculateExp) {
            userToUpdateAvailableBalance = Number((userToUpdateAvailableBalance + Number(bet.exposureAmount)));
            addExposureAmount = Number(bet.exposureAmount);
            calculatedExp = 1;
          }
          const UpdatedExposure = Number((userToUpdate.exposure + addExposureAmount));
          const UpdatedAvailableBalance = Number((userToUpdate.availableBalance + Number(userToUpdateAvailableBalance)));
          const exists = await Deposits.findOne({
            userId: userToUpdate.userId,
            betId: bet._id,
            amount: remainingAmount,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          });
          if (exists) {
            console.log('=====================handleWinningBet exists=====================');
            console.log(bet._id, bet.status);
            console.log('=====================handleWinningBet exists=====================');

            return;
          }
          let expPositiveData;
          expPositiveData = await expPositive.findOne({ userId:userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
              
              if(expPositiveData && bet.calculateExp==true){
                //console.log("winningsShareAmount=============================================>",winningsShareAmount);
                
                await expPositive.updateOne(
                  {
                    userId:userId,betId:bet._id.toString()
                  },
                  {
                    expReleased: addExposureAmount,
                    expReleasedC:expPositiveData.expCaptured,
                    updatedAt:Date.now(),
                     
                      diff: remainingAmount,
                      BFavailableBalance: userToUpdate.availableBalance,
                      AFavailableBalance: userToUpdate.availableBalance + Math.abs(expPositiveData.expCaptured) + remainingAmount,

                    expAfterRelease:userToUpdate.exposure  + Math.abs(expPositiveData.expCaptured)
                    
                  },
                  { session }
                );
                availableBalance2  = Math.abs(expPositiveData.expCaptured) + remainingAmount + userToUpdate.availableBalance
              

          await User.updateOne(
            {
              userId: userId,
              isDeleted: false
            },
            {
              balance: UpdatedBalance,
              clientPL: UpdatedclientPL,
              availableBalance2:availableBalance2,
              tempExposure:userToUpdate.tempExposure + Math.abs(expPositiveData.expCaptured),
              exposure: UpdatedExposure,
              availableBalance: UpdatedAvailableBalance
            },
            { session }
          );
              }else{

               

          await User.updateOne(
            {
              userId: userId,
              isDeleted: false
            },
            {
              balance: UpdatedBalance,
              clientPL: UpdatedclientPL,
              exposure: UpdatedExposure,
              availableBalance: UpdatedAvailableBalance
            },
            { session }
          );


              }
              
          
          

          const lastMaxWithdraw = await Deposits.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });

          
		  await Deposits.create([{
            userId: userToUpdate.userId,
            description: `Event (${bet.event}) Runner (${bet.runnerName})`,
            betId: bet._id.toString(),
            createdBy: 0,
            amount: remainingAmount,
            balance: lastMaxWithdraw ? lastMaxWithdraw.balance + remainingAmount : remainingAmount,
            availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + remainingAmount : remainingAmount,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + remainingAmount : remainingAmount,
            cashOrCredit: 'Bet',
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId,
            betType: bet.type,
            betDateTime: bet.betTime,
            date: new Date().getTime(),
            createdAt: formattedDate,
            betSession: bet.betSession,
            roundId: bet.roundId,
            addedExpoisureAmount: addExposureAmount,
            UserPrevexposure: userToUpdate.exposure,
            UpdatedExposure: UpdatedExposure,
       

  
          
            calculateExp:bet.calculateExp,
       
          }],
          { session });
		  
          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: {
              $in: [...parentUserIds]
            },
            isDeleted: false
          }).sort({ userId: -1 });
          if (!parentUser) {
            console.error(' Error: Parent Users Not Found Location:(_handle Winning  bet) ');
            return;
          } else {
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            let commissionFrom = userToUpdate.userId;
            let runnersPosition = bet.runnersPosition;
            highestAmount = Math.max(...runnersPosition.map(runner => runner.position));

            for (const user of parentUser) {
              let expPositiveDataP;
              expPositiveDataP = await expPositive.findOne({ userId:user.userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
              if(expPositiveDataP && expPositiveDataP.calculateExp===true && expPositiveDataP.isUsed===0){
              const totalExpoisure = Number((user.exposure + Number(((user.commission / 100) * totalRemainingAmount))));
              const totalBalance = Number((user.balance - Number(((user.commission / 100) * remainingAmount))));
              const totalavailableBalance = Number((user.availableBalance + Number(((user.commission / 100) * commissionAmount))));
              const totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount)) : 0;
              const totalClientPL = Number((user.clientPL + totalClientPLAmount));
              
              let winningsShareAmount = Number(((user.commission / 100) * TotalLoosingAmount));
              let UpdatedExposureAmount = user.exposure + winningsShareAmount;
              // console.log("user.userId========================================>",user.userId);
              // console.log("bet.calculateExp===================================",bet.calculateExp);

              
              

              if(bet.calculateExp==true){
                if(expPositiveDataP){
                  //console.log("winningsShareAmount=============================================>",winningsShareAmount);
                  
                  await expPositive.updateOne(
                    {
                      userId:user.userId,betId:bet._id.toString()
                    },
                    {
                      expReleased: winningsShareAmount,
                      expReleasedC:expPositiveDataP.expCaptured,
                      updatedAt:Date.now(),
    
                      diff: winningsShareAmount,
                      BFavailableBalance: user.availableBalance,
                      AFavailableBalance: user.availableBalance ,
  
                      expAfterRelease:user.exposure  + Math.abs(expPositiveDataP.expCaptured),
                      AbAtRelease:totalBalance + UpdatedExposureAmount,
                      isUsed:1
                      
                    },
                    { session }
                  );
                }

                let winningsShareAmount2 = Number(((user.commission / 100) * highestAmount));
                let UpdatedExposureAmount2 = user.exposure + winningsShareAmount2;
                
                
              if(expPositiveDataP.calculateExp===true && expPositiveDataP.isUsed===0){
                
                let updatetempExposure = user.tempExposure + Math.abs(expPositiveDataP.expCaptured)
                console.log("expPositiveDataP._id::::",expPositiveDataP._id,"isUsed:::::",expPositiveDataP.isUsed);
                console.log("expPositiveDataP.betId::::::::::::::::",expPositiveDataP.betId);
                console.log(":::user.tempExposure::::::::::::::::::::::::::::::::::",user.tempExposure);
                console.log("Math.abs(expPositiveDataP.expCaptured::::::::::::::::",Math.abs(expPositiveDataP.expCaptured));
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::",updatetempExposure);
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log("-------------------------------winning--------------------");
                await User.updateOne(
                  {
                    _id: user?._id
                  },
                  {
                   
                   
                    tempExposure:updatetempExposure,
                    
                    availableBalance2: totalBalance + UpdatedExposureAmount2
                  },{session}
                );
              }
              
              
              await User.updateOne(
                  {
                    userId: user.userId,
                    isDeleted: false
                  },
                  {
                    balance: totalBalance,
                    
                    exposure: UpdatedExposureAmount2,
                    availableBalance: totalBalance + UpdatedExposureAmount2,
                    clientPL: totalClientPL
                  },
                  { session }
                );

              }else{
                console.log("Math.abs(expPositiveDataP.expCaptured)-----------handle winning IF true---------");
              
                await User.updateOne(
                  {
                    userId: user.userId,
                    isDeleted: false
                  },
                  {
                    balance: totalBalance,
                    //exposure: UpdatedExposureAmount,
                   //tempExposure:user.tempExposure + Math.abs(expPositiveDataP.expCaptured),
                    //availableBalance2: totalBalance + UpdatedExposureAmount2,
                    clientPL: totalClientPL
                  },
                  { session }
                );
              }
              
             
                       
              
              
              
			  
              
			  
              const upLineAmount = totalClientPLAmount;
              
              let amount = -(user.commission / 100) * totalRemainingAmount;
              
                
              let Dbalance = amount
              let DavailableBalance = amount;
              
              const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : - ( Math.abs(amount) + Math.abs(upLineAmount) )

              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
              
              if(lastMaxWithdraw){
                Dbalance = lastMaxWithdraw.balance + (amount)
                DavailableBalance = lastMaxWithdraw.availableBalance + (amount)
              }
              //let DavailableBalance = lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (amount) : -(amount);

              let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (amount) : -( amount );
              
              let Dcash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
              let Dcredit = lastMaxWithdraw?.credit || 0;
              let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;
              
           
              let Camount = (2/100)*( (user.commission / 100) * totalRemainingAmount);
                 
              //if(bet.calculateExp==true){
			  await Deposits.create([{
                userId: user.userId,
                description: `Event (${bet.event}) Runner (${bet.runnerName})`,
                createdBy: 0,
                amount: amount,
                balance:Dbalance, 
                availableBalance: DavailableBalance,
                maxWithdraw: DmaxWithdraw,
                cash: Dcash,
                credit: Dcredit,
                creditRemaining: DcreditRemaining,marketId: bet.marketId,
                cashOrCredit: 'Bet',
                commissionFrom: commissionFrom,
                sportsId: bet.sportsId,
                shareNUpline:shareNUpline,
                upLineAmount: upLineAmount,
                betId: bet._id.toString(),
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
                totalRemainingAmount: totalRemainingAmount,
                commissionAmount: commissionAmount,
                remainingAmount: remainingAmount,
                betSession: bet.betSession,
                roundId: bet.marketId,

                addedExpoisureAmount: Number(((user.commission / 100) * totalRemainingAmount)),
                UserPrevexposure: user.exposure,
                UpdatedExposure: totalExpoisure,
                exposure: 'Number(((user.commission / 100) * totalRemainingAmount))',
    
              }],
              { session });
            //}
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ 
              userId: user.userId,
              betSession: bet.betSession,
              marketId: bet.marketId
  
  
            },{ session });
            
              
            }//for parents loop

            let winnerRunnerData = 0;
            let SessionScore = 0;
            if (bet.isfancyOrbookmaker && bet.fancyData != null) {
              const marketInfo = await MarketIDS.findOne({
                sportID: bet.sportsId,
                marketId: bet.marketId
              });
              winnerRunnerData = marketInfo?.winnerRunnerData;
            } else if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
              const match = await Events.findById(bet.matchId);
              const marketInfo = await Sessions.findOne({
                eventId: Number(match.Id),
                sessionNo: bet.betSession
              });
              SessionScore = marketInfo?.score;
            }
            await Bets.updateOne(
              { _id: bet._id },
              {
                status: 0,
                position: Number(bet.winningAmount),
                iscalculatedExp: calculatedExp,
                winnerRunnerData: winnerRunnerData,
                SessionScore: SessionScore,
                updatedAt: new Date().getTime()
              },
              { session }
            );
			
			
            
            await CurrentPosition.deleteMany({ 
              userId: userId,
              
              marketId: bet.marketId
  
  
            },{ session });
            
            await CurrentPosition2.deleteMany({ 
              userId: user.userId,
              
              marketId: bet.marketId
  
  
            },{ session });
            await RunnerWiselossShares.deleteMany({ 
              userId: user.userId,
              
              marketId: bet.marketId
  
  
            },{ session });
            
          }
        }//end parents for loop
      
      
      
      
      
        
        }
      
      
      
      
      
      }
    }
          await session.commitTransaction();
      break; // Exit loop if transaction succeeds
  } catch (error) {
    console.log(error,"==============================================================================");
    if ( retries < maxRetries) {
      retries++;
      console.log(`Retrying transaction...calculation3 attempt ${retries}`);
      continue; // Retry the transaction
    } else {
      console.error('Transaction Error:', error);
      await session.abortTransaction();
      break; // Exit loop if error is not transient
    }
  }finally {
    session.endSession();
  }
}//end while loop
}
async function handleLosingBetX(bet) {
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;

  while (retries < maxRetries) {
    try {
    if (bet.status == 1) {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const userId = bet.userId;
        const loosingAmount = Number(bet.loosingAmount);
        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });
        if (!userToUpdate) {
          console.error('Error: User Not Found Location:(_handle losing bet)');
          return;
        } else {
          session.startTransaction();
          const exists = await Deposits.findOne({
            userId: userToUpdate.userId,
            betId: bet._id,
            amount: -loosingAmount,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          });
          if (exists) {
            console.log('=====================handleLosingBet exists=====================');
            console.log(bet._id, bet.status);
            console.log('=====================handleLosingBet exists=====================');
            await Bets.updateOne(
              { _id: bet._id },
              {
                status: 0,
                updatedAt: new Date().getTime()
              }
            );
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ 
              userId: bet.userId,
              betSession: bet.betSession,
              marketId: bet.marketId
  
  
            },{ session });
            return;
          }
          const user_prev_balance = userToUpdate.balance;
          const user_prev_availableBalance = userToUpdate.availableBalance;
          const user_prev_exposure = userToUpdate.exposure;

          const updatedBalance = Number((userToUpdate.balance - loosingAmount));
          const updatedClientPL = Number((userToUpdate.clientPL - loosingAmount));
          let userToUpdateAvailableBalance = -loosingAmount;
          let addExposureAmount = 0;
          if (bet.calculateExp === true) {
            userToUpdateAvailableBalance = Number((userToUpdateAvailableBalance + Number(bet.exposureAmount)));
            addExposureAmount = Number(bet.exposureAmount);
            calculatedExp = 1;
          }
          const expAmount = Number((userToUpdate.exposure + addExposureAmount));
          const updatedAvailableBalance = Number(userToUpdate.availableBalance + Number(userToUpdateAvailableBalance));
          let expPositiveData
          expPositiveData = await expPositive.findOne({ userId:userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
              
          if(expPositiveData && bet.calculateExp === true){
            //console.log("winningsShareAmount=============================================>",winningsShareAmount);
            
            await expPositive.updateOne(
              {
                userId:userId,betId:bet._id.toString()
              },
              {
                expReleased: addExposureAmount,
                updatedAt:Date.now(),
                expReleasedC:expPositiveData.expCaptured,
                diff: -loosingAmount,
                BFavailableBalance: userToUpdate.availableBalance,
                AFavailableBalance: userToUpdate.availableBalance,
                isUsed:1,
                expAfterRelease:userToUpdate.exposure  + Math.abs(expPositiveData.expCaptured)
                
              },
              { session }
            );
            availableBalance2  = userToUpdate.availableBalance
              
		  await User.updateOne(
            {
              userId: userId,
              isDeleted: false
            },
            {
              balance: updatedBalance,
              clientPL: updatedClientPL,
              exposure: expAmount,
              availableBalance2:availableBalance2,
              tempExposure:userToUpdate.tempExposure + Math.abs(expPositiveData.expCaptured),
              availableBalance: updatedAvailableBalance
            },{session}
          );
          }
         
          await User.updateOne(
            {
              userId: userId,
              isDeleted: false
            },
            {
              balance: updatedBalance,
              clientPL: updatedClientPL,
              exposure: expAmount,
              
              
              availableBalance: updatedAvailableBalance
            },{session}
          );
        
		  
          const lastMaxWithdraw = await Deposits.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });
          
		  await Deposits.create([{
            userId: userToUpdate.userId,
            description: `Event (${bet.event}) Runner (${bet.runnerName})`,
            amount: -loosingAmount,
            balance: lastMaxWithdraw ? lastMaxWithdraw.balance - loosingAmount : -loosingAmount,
            availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - loosingAmount : -loosingAmount,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - loosingAmount : loosingAmount,
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            createdBy: 0,
            cashOrCredit: 'Bet',
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId,
            betId: bet._id.toString(),
            betType: bet.type,
            betDateTime: bet.betTime,
            date: new Date().getTime(),
            createdAt: formattedDate,
            betSession: bet.betSession,
            roundId: bet.roundId,
            addedExpoisureAmount: addExposureAmount,
            UserPrevexposure: userToUpdate.exposure,
            UpdatedExposure: expAmount,
       

            

            

            calculateExp:bet.calculateExp,
            
          }],{session});
		  
		  
          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: { $in: parentUserIds },
            isDeleted: false
          }).sort({ userId: -1 });
          if (!parentUser) {
            console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
            return;
          } else {
            const remainingAmount = Number(bet.winningAmount);
            const TotalLoosingAmount = Number(bet.loosingAmount);
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            let commissionFrom = userToUpdate.userId;
            let upMovingAmount = TotalLoosingAmount;
            
            let runnersPosition = bet.runnersPosition;
            highestAmount = Math.max(...runnersPosition.map(runner => runner.position));

            for (const user of parentUser) {
              let expPositiveDataP;
              expPositiveDataP = await expPositive.findOne({ userId:user.userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
            
             
              const totalExpoisure = Number((user.exposure + Number(((user.commission / 100) * remainingAmount))));
              const totalavailableBalance = Number((user.availableBalance + Number(((user.commission / 100) * remainingAmount + (user.commission / 100) * TotalLoosingAmount))));
              const totalBalance = Number((user.balance + Number(((user.commission / 100) * TotalLoosingAmount))));
              const totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * TotalLoosingAmount)) : 0;
              const totalClientPL = Number((user.clientPL - totalClientPLAmount));
              let winningsShareAmount = Number(((user.commission / 100) * TotalLoosingAmount));
              let UpdatedExposureAmount = user.exposure + winningsShareAmount;
              console.log("user.userId========================================>",user.userId);
              console.log("bet.calculateExp===================================",bet.calculateExp);
              
              
              if(bet.calculateExp==true){
                console.log("highestAmount========================================>",highestAmount);
                let winningsShareAmount2 = Number(((user.commission / 100) * highestAmount));
                console.log("winningsShareAmount2--------------------------------------------",winningsShareAmount2);
                console.log("user.exposure-----------------------------------------------",user.exposure);
                
                let UpdatedExposureAmount2 = user.exposure + winningsShareAmount2;
                console.log("UpdatedExposureAmount2--------------------------------------------",UpdatedExposureAmount2);
                
                 
			  
			  
			  

              
              if(expPositiveDataP){
                //console.log("winningsShareAmount=============================================>",winningsShareAmount);
                await expPositive.updateOne(
                  {
                    userId:user.userId,betId:bet._id.toString()
                  },
                  {
                    expReleased: winningsShareAmount,
                    expReleasedC:expPositiveDataP.expCaptured,
                    updatedAt:Date.now(),
                
                    diff: winningsShareAmount,
                    BFavailableBalance: user.availableBalance,
                    AFavailableBalance: user.availableBalance + Math.abs(expPositiveDataP.expCaptured) + winningsShareAmount,
                    
                    expAfterRelease:user.exposure  + Math.abs(expPositiveDataP.expCaptured),
                    
                    AbAtRelease:totalBalance + UpdatedExposureAmount
                    
                  },{session}
                );
              }
              
              
              if(expPositiveDataP.calculateExp===true && expPositiveDataP.isUsed===0){
                
                let updatetempExposure = user.tempExposure + Math.abs(expPositiveDataP.expCaptured)
                console.log("expPositiveDataP._id::::",expPositiveDataP._id,"isUsed:::::",expPositiveDataP.isUsed);
                console.log("expPositiveDataP.betId::::::::::::::::",expPositiveDataP.betId);
                console.log(":::user.tempExposure::::::::::::::::::::::::::::::::::",user.tempExposure);
                console.log("Math.abs(expPositiveDataP.expCaptured::::::::::::::::",Math.abs(expPositiveDataP.expCaptured));
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::",updatetempExposure);
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log("-------------------------------Loosing--------------------");
                await User.updateOne(
                  {
                    _id: user?._id
                  },
                  {
                   
                   
                    tempExposure:updatetempExposure,
                    
                    availableBalance2: totalBalance + UpdatedExposureAmount2
                  },{session}
                );
              }
              await User.updateOne(
                  {
                    _id: user?._id
                  },
                  {
                    balance: totalBalance,
                    clientPL: totalClientPL,
                    exposure: UpdatedExposureAmount2,
                    
                    availableBalance: totalBalance + UpdatedExposureAmount2,
                    
                  },{session}
                );


              }else{
                console.log("Math.abs(expPositiveDataP.expCaptured)-----------handle loosing else FALSE---------");
                await User.updateOne(
                  {
                    _id: user?._id
                  },
                  {
                    balance: totalBalance,
                    clientPL: totalClientPL,
                    //exposure: UpdatedExposureAmount2,
                    //tempExposure:user.tempExposure + Math.abs(expPositiveDataP.expCaptured),
                    //availableBalance2: totalBalance + UpdatedExposureAmount2
                  },{session}
                );
              }
              
              console.log("bet.winningAmount========================================>",bet.winningAmount);
              console.log("bet.loosingAmount========================================>",bet.loosingAmount);
              console.log("totalRemainingAmount not defined in losingBetX========================================>");
              console.log("remainingAmount========================================>",remainingAmount);

              
              
              
              
             
              //
              const upLineAmount = -totalClientPLAmount;
              let amount = (user.commission / 100) * TotalLoosingAmount;
              
                
              let Dbalance = amount
              let DavailableBalance = amount;
              
              const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : - ( Math.abs(amount) + Math.abs(upLineAmount) )

              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
              
              if(lastMaxWithdraw){
                Dbalance = lastMaxWithdraw.balance + (amount)
                DavailableBalance = lastMaxWithdraw.availableBalance + (amount)
              }
              //let DavailableBalance = lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (amount) : -(amount);

              let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (amount) : -( amount );
              
              let Dcash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
              let Dcredit = lastMaxWithdraw?.credit || 0;
              let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;
              
              


              //if(bet.calculateExp==true){
              
			  await Deposits.create([{
                userId: user.userId,
                description: `Event (${bet.event}) Runner (${bet.runnerName})`,
                createdBy: 0,
                amount: amount,
                balance: Dbalance,
                availableBalance: DavailableBalance,
                maxWithdraw: DmaxWithdraw,
                cash: Dcash,
                credit: Dcredit,
                creditRemaining: DcreditRemaining,
                commissionFrom: commissionFrom,
                cashOrCredit: 'Bet',
                marketId: bet.marketId,
                sportsId: bet.sportsId,
                upLineAmount: upLineAmount,
                shareNUpline:shareNUpline,
                betId: bet._id.toString(),
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
                betSession: bet.betSession,
                roundId: bet.roundId,
                addedExpoisureAmount: Number(((user.commission / 100) * remainingAmount)),
                UserPrevexposure: user.exposure,
                UpdatedExposure: totalExpoisure,
                exposure: 'Number(((user.commission / 100) * remainingAmount))',
     
              }],{session});
			  
              upMovingAmount = 0;
              //upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount));

           // }
              commissionFrom = user.userId;

              //const betIdString = bet._id.toString();
              await CurrentPosition.deleteMany({ 
                userId: user.userId,
                betSession: bet.betSession,
                marketId: bet.marketId
    
    
              },{ session });
           


            

            let winnerRunnerData = 0;
            let SessionScore = 0;

            if (bet.isfancyOrbookmaker && bet.fancyData != null) {
              const marketInfo = await MarketIDS.findOne({
                sportID: bet.sportsId,
                marketId: bet.marketId
              });
              winnerRunnerData = marketInfo?.winnerRunnerData;
            } else if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
              const match = await Events.findById(bet.matchId);
              const marketInfo = await Sessions.findOne({
                eventId: Number(match.Id),
                sessionNo: bet.betSession
              });
              SessionScore = marketInfo?.score;
            }
            
			await Bets.updateOne(
              {
                _id: bet._id
              },
              {
                status: 0,
                position: bet.loosingAmount * -1,
                iscalculatedExp: calculatedExp,
                winnerRunnerData: winnerRunnerData,
                SessionScore: SessionScore,
                updatedAt: new Date().getTime()
              },{session}
            );
			
			
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ 
              userId: userId,
          
              marketId: bet.marketId
  
  
            },{ session });
            await CurrentPosition2.deleteMany({ 
              userId: user.userId,
              
              marketId: bet.marketId
  
  
            },{ session });
            await RunnerWiselossShares.deleteMany({ 
              userId: user.userId,
              
              marketId: bet.marketId
  
  
            },{ session });


          }
          }//end parents for loop
        }
      }
    }
    await session.commitTransaction();
    break; // Exit loop if transaction succeeds
  } catch (error) {
    console.log(error,"==============================================================================");
    if ( retries < maxRetries) {
      retries++;
      console.log(`Retrying transaction...calculations2 attempt ${retries}`);
      continue; // Retry the transaction
    } else {
      console.error('Transaction Error:', error);
      await session.abortTransaction();
      break; // Exit loop if error is not transient
    }
}finally {
  session.endSession();
}
}
}
const handleDrawBetX = async (bet, status = 0) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;

  while (retries < maxRetries) {
    try {
    if (bet.status == 1) {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const totalRemainingAmount = Number(bet.winningAmount);
        const userId = bet.userId;
        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });
        if (!userToUpdate) {
          console.error('Error: User Not Found Location:(_handle draw bet)');
          return;
        } else {
          const user_prev_balance = userToUpdate.balance;
          const user_prev_availableBalance = userToUpdate.availableBalance;
          const user_prev_exposure = userToUpdate.exposure;

          const updatedUserAvlBalance = Number((userToUpdate.availableBalance + Number(bet.exposureAmount)));
          const updatedUserExp = Number((userToUpdate.exposure + Number(bet.exposureAmount)));

          if (bet.calculateExp === true) {

            let expPositiveData;
          expPositiveData = await expPositive.findOne({ userId:userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
           

            await expPositive.updateOne(
              {
                userId:userId,betId:bet._id.toString()
              },
              {
                expReleased: expPositiveData.expCaptured,
                expReleasedC:expPositiveData.expCaptured,
                updatedAt:Date.now(),
                 
                  diff: 0,
                  BFavailableBalance: userToUpdate.availableBalance,
                  AFavailableBalance: userToUpdate.availableBalance + Math.abs(expPositiveData.expCaptured),

                expAfterRelease:userToUpdate.exposure  + Math.abs(expPositiveData.expCaptured),
                isUsed:1
                
              },
              { session }
            );


            
            calculatedExp = 1;
            
			await User.updateOne(
              {
                userId: userId,
                isDeleted: false
              },
              {
                availableBalance: updatedUserAvlBalance,
                exposure: updatedUserExp
              },{session}
            );
			
          }

          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: { $in: [...parentUserIds] },
            isDeleted: false
          }).sort({ role: -1 });
          if (!parentUser) {
            console.error(' Error : Parent User Not Found Location:(_handle Draw bet ) ');
            return;
          } else {
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            for (const user of parentUser) {
              const amountToBeAddedExp = Number((user.exposure + Number(((user.commission / 100) * totalRemainingAmount))));
              const amountToBeAddedAvlBalance = Number((user.availableBalance + Number(((user.commission / 100) * totalRemainingAmount))));
              


              let expPositiveDataP;
          expPositiveData = await expPositive.findOne({ userId:userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
           

            await expPositive.updateOne(
              {
                userId:userId,betId:bet._id.toString()
              },
              {
                expReleased: expPositiveDataP.expCaptured,
                expReleasedC:expPositiveDataP.expCaptured,
                updatedAt:Date.now(),
                 
                  diff: 0,
                  BFavailableBalance: user.availableBalance,
                  AFavailableBalance: user.availableBalance + Math.abs(expPositiveDataP.expCaptured),

                expAfterRelease:user.exposure  + Math.abs(expPositiveDataP.expCaptured)
                
              },
              { session }
            );



			  await User.updateOne(
                {
                  _id: user._id
                },
                {
                  exposure: amountToBeAddedExp,
                  availableBalance: amountToBeAddedAvlBalance
                },{session}
              );
            
            }
            
			await Bets.updateOne(
              { _id: bet._id },
              {
                position: 0,
                status: status,
                iscalculatedExp: calculatedExp,
                updatedAt: new Date().getTime()
              },{session}
            );
			
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ 
              userId: bet.userId,
              betSession: bet.betSession,
              marketId: bet.marketId
  
  
            },{ session });
            const updatedUser = await User.findOne({
              userId: userId,
              isDeleted: false
            });
            const user_new_balance = updatedUser.balance;
            
          }
        }
      }
    }
    await session.commitTransaction();
    break; // Exit loop if transaction succeeds
  } catch (error) {
    console.log(error,"==============================================================================");
    if ( retries < maxRetries) {
      retries++;
      console.log(`Retrying transaction...calcuations1 attempt ${retries}`);
      continue; // Retry the transaction
    } else {
      console.error('Transaction Error:', error);
      await session.abortTransaction();
      break; // Exit loop if error is not transient
    }
  } finally {
    session.endSession();
  }
}
};



async function handleWinningBetXX(bet) {


  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;

  while (retries < maxRetries) {
  try {
    if (bet.status == 1 && bet.calculateExp == true && bet.resultData != '.') {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const userId = bet.userId;
  
        

        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });

        if (!userToUpdate) {
          console.error('Error: user not found Location:(_handle winning bet)');
          return;
        } else {
          
          session.startTransaction();
         
          
       
          const runnersPosition = bet.runnersPosition;
          console.log("runnersPosition----------",runnersPosition);
          let winningAmount;
          const resultData = Number(bet.resultData);
          console.log("resultData--------------------",resultData);
          const targetRunner = runnersPosition.find(entry => entry.runner === resultData);
          console.log("targetRunner--------------------",targetRunner);
          if (targetRunner) {
            // If resultData matches a runner, set winningAmount to its position
            winningAmount = targetRunner.position;
            console.log("winningAmount in targetRunner--------------------",winningAmount);
          } else {
           
            // Determine the highest and lowest runner values
            const highestRunner = runnersPosition.reduce((max, entry) => entry.runner > max.runner ? entry : max);
            const lowestRunner = runnersPosition.reduce((min, entry) => entry.runner < min.runner ? entry : min);
          
            if (resultData > highestRunner.runner) {
              // If resultData is greater than the highest runner, set winningAmount to highest runner's position
              winningAmount = highestRunner.position;
            } else if (resultData < lowestRunner.runner) {
              // If resultData is less than the lowest runner, set winningAmount to lowest runner's position
              winningAmount = lowestRunner.position;
            }
            console.log("winningAmount in targetRunner ELSE--------------------",winningAmount);
          }
          console.log("winningAmount-----------------------",winningAmount);
          const lowestPosition = runnersPosition.reduce((min, entry) => entry.position < min.position ? entry : min).position;

         
          //lowestPosition is the exposure
         
          
         
          const exists = await Deposits.findOne({
            userId: userToUpdate.userId,
            betId: bet._id,
            
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          });
          if (exists) {
            console.log('=====================handleWinningBet exists=====================');
            console.log(bet._id, bet.status);
            console.log('=====================handleWinningBet exists=====================');

            return;
          }
         
         let updateavailableBalance
         let commissionAmount = 0
         let updateUserExposure   
         let UpdatedclientPL 
         let UpdatedBalance
         updateUserExposure = Number(userToUpdate.exposure + Math.abs(lowestPosition))
         updateavailableBalance = Number(userToUpdate.availableBalance)
         UpdatedclientPL = Number(userToUpdate.clientPL)
         UpdatedBalance = Number(userToUpdate.balance)
         if (winningAmount>0){
          
          commissionAmount = 0.02*winningAmount
          updateavailableBalance = Number(userToUpdate.availableBalance + Math.abs(lowestPosition) + winningAmount)
          UpdatedclientPL = Number(userToUpdate.clientPL + (winningAmount))
          UpdatedBalance = Number(userToUpdate.balance + (winningAmount))
          
          }else if (winningAmount<0){
         
         
            UpdatedclientPL = Number(userToUpdate.clientPL + (winningAmount))
            UpdatedBalance = Number(userToUpdate.balance + (winningAmount))
            
            }else if (winningAmount===0){
         
              updateavailableBalance = Number(userToUpdate.availableBalance + Math.abs(lowestPosition))
              
              
              }
         /*
         100
         suppose he WON 100, mean if (winningAmount>0){
         
         updateavailableBalance = userToUpdate.availableBalance + Math.abs(lowestPosition) + winningAmount
         UpdatedclientPL = userToUpdate.clientPL + (winningAmount)
         UpdatedBalance = userToUpdate.balance + (winningAmount)
         
         }
         suppose he lost 100, mean if (winningAmount<0){
         
         
         UpdatedclientPL = userToUpdate.clientPL + (winningAmount)
         UpdatedBalance = userToUpdate.balance + (winningAmount)
         
         }
         suppose he lost nothing, mean if (winningAmount===0){
         
         updateavailableBalance = userToUpdate.availableBalance + Math.abs(lowestPosition)
         
         
         }
         */
         console.log("UpdatedBalance user----",UpdatedBalance);
			   console.log("UpdatedclientPL user----",UpdatedclientPL);
			   console.log("updateUserExposure user----",updateUserExposure);
			   console.log("updateavailableBalance user----",updateavailableBalance);
			   
          await User.updateOne(
            {
              userId: userId,
              isDeleted: false
            },
            {
              balance: UpdatedBalance,
              clientPL: UpdatedclientPL,
              
              exposure: updateUserExposure,
              availableBalance: updateavailableBalance
            },
            { session }
          );



          const lastMaxWithdraw = await Deposits.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });

          console.log("lastMaxWithdraw----",lastMaxWithdraw);
		  await Deposits.create([{
            userId: userToUpdate.userId,
            description: `Event (${bet.event}) Runner (${bet.runnerName})`,
            betId: bet._id.toString(),
            createdBy: 0,
            amount: winningAmount,
            balance: lastMaxWithdraw ? lastMaxWithdraw.balance + winningAmount : winningAmount,
            availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + winningAmount : winningAmount,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + winningAmount : winningAmount,
            cashOrCredit: 'Bet',
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId,
            betType: bet.type,
            betDateTime: bet.betTime,
            date: new Date().getTime(),
            createdAt: formattedDate,
            betSession: bet.betSession,
            roundId: bet.roundId,
           

  
          
            calculateExp:bet.calculateExp,
       
          }],
          { session });
          console.log("deposits of user done....");
          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: {
              $in: [...parentUserIds]
            },
            isDeleted: false
          }).sort({ userId: -1 });
          if (!parentUser) {
            console.error(' Error: Parent Users Not Found Location:(_handle Winning  bet) ');
            return;
          } else {
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            let commissionFrom = userToUpdate.userId;
            let dealersCommissionAmount = 0

            for (const user of parentUser) {
              let expPositiveDataP;
              expPositiveDataP = await expPositive.findOne({ userId:user.userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
              const totalExpoisure = expPositiveDataP.expCaptured;
              let totalBalance = user.balance;
              let totalClientPL= user.clientPL
              let totalClientPLAmount
              let updatedtotalavailableBalance = Number(user.availableBalance)
              let reversedavailableBalance = user.availableBalance + totalExpoisure
              console.log("winningAmount::::",winningAmount);
              let FinalShareAmount = Number(((user.commission / 100) * Math.abs(winningAmount)  ))
              dealersCommissionAmount = Number(((user.commission / 100) * FinalShareAmount  ))
              if(winningAmount>0){
                
               
                updatedtotalavailableBalance = Number((reversedavailableBalance - FinalShareAmount));
                totalBalance = Number((user.balance - FinalShareAmount));
                totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * winningAmount)) : 0;
                totalClientPL = Number((user.clientPL + totalClientPLAmount));
                
                
             
              }else if(winningAmount<0){
               updatedtotalavailableBalance = Number((reversedavailableBalance + FinalShareAmount));
               totalBalance = Number((user.balance + Number(((user.commission / 100) * Math.abs(winningAmount)))));
               totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * Math.abs(winningAmount))) : 0;
               totalClientPL = Number((user.clientPL - totalClientPLAmount));
              
              
              }else{
                updatedtotalavailableBalance = reversedavailableBalance
                
              }
              
           
               

              console.log("------:reversedavailableBalance:",reversedavailableBalance);
               console.log("------:totalBalance:",totalBalance);
               console.log("------:totalExpoisure:",totalExpoisure);
               console.log("------:updatedtotalavailableBalance:",updatedtotalavailableBalance);
               console.log("------:totalClientPL:",totalClientPL);
              
              
              await User.updateOne(
                  {
                    userId: user.userId,
                    isDeleted: false
                  },
                  {
                    balance: totalBalance,
                    
                    exposure: user.exposure + totalExpoisure,
                    availableBalance: updatedtotalavailableBalance,
                    clientPL: totalClientPL
                  },
                  { session }
                );

              
              
             
                       
              
              
              
			  
              
			  
              const upLineAmount = totalClientPLAmount;
              
              let amount = (user.commission / 100) * winningAmount;
              
                
              let Dbalance = amount
              let DavailableBalance = amount;
              
              const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : - ( Math.abs(amount) + Math.abs(upLineAmount) )

              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
              
              if(lastMaxWithdraw){
                Dbalance = lastMaxWithdraw.balance + (amount)
                DavailableBalance = lastMaxWithdraw.availableBalance + (amount)
              }
              //let DavailableBalance = lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (amount) : -(amount);

              let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (amount) : -( amount );
              
              let Dcash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
              let Dcredit = lastMaxWithdraw?.credit || 0;
              let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;
              
           
              
              
                 
              //if(bet.calculateExp==true){
			  await Deposits.create([{
                userId: user.userId,
                description: `Event (${bet.event}) Runner (${bet.runnerName})`,
                createdBy: 0,
                amount: amount,
                balance:Dbalance, 
                availableBalance: DavailableBalance,
                maxWithdraw: DmaxWithdraw,
                cash: Dcash,
                credit: Dcredit,
                creditRemaining: DcreditRemaining,marketId: bet.marketId,
                cashOrCredit: 'Bet',
                commissionFrom: commissionFrom,
                sportsId: bet.sportsId,
                shareNUpline:shareNUpline,
                upLineAmount: upLineAmount,
                betId: bet._id.toString(),
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
               
                commissionAmount: dealersCommissionAmount,
              
                betSession: bet.betSession,
                roundId: bet.marketId,

            
                
    
              }],
              { session });
            //}
           
            await CurrentPosition.deleteMany({ 
              userId: user.userId,
              betSession: bet.betSession,
              marketId: bet.marketId
  
  
            },{ session });
            
              
            //for parents loop

            let winnerRunnerData = 0;
            let SessionScore = 0;
     
              const marketInfo = await MarketIDS.findOne({
                sportID: bet.sportsId,
                marketId: bet.marketId
              });
              winnerRunnerData = marketInfo?.winnerRunnerData;
            
            await Bets.updateOne(
              { _id: bet._id },
              {
                status: 0,
                position: Number(bet.winningAmount),
                iscalculatedExp: calculatedExp,
                winnerRunnerData: winnerRunnerData,
                SessionScore: SessionScore,
                updatedAt: new Date().getTime()
              },
              { session }
            );
			
			
            
            await CurrentPosition.deleteMany({ 
              userId: userId,
              
              marketId: bet.marketId
  
  
            },{ session });
            
            await CurrentPosition2.deleteMany({ 
              userId: user.userId,
              
              marketId: bet.marketId
  
  
            },{ session });
            await RunnerWiselossShares.deleteMany({ 
              userId: user.userId,
              
              marketId: bet.marketId
  
  
            },{ session });
            
          }
        }//end parents for loop
      
      
      
      
      
        
        }
      
      
      
      
      
      }
    }
          await session.commitTransaction();
      break; // Exit loop if transaction succeeds
  } catch (error) {
    console.log(error,"==============================================================================");
    if ( retries < maxRetries) {
      retries++;
      console.log(`Retrying transaction...calculation3 attempt ${retries}`);
      continue; // Retry the transaction
    } else {
      console.error('Transaction Error:', error);
      await session.abortTransaction();
      break; // Exit loop if error is not transient
    }
  }finally {
    session.endSession();
  }
}//end while loop
}
async function handleLosingBetXX(bet) {
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");
  console.log("I am XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXloser");

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;

  while (retries < maxRetries) {
    try {
    if (bet.status == 1  && bet.calculateExp == true) {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const userId = bet.userId;
        const loosingAmount = Number(bet.loosingAmount);
        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });
        if (!userToUpdate) {
          console.error('Error: User Not Found Location:(_handle losing bet)');
          return;
        } else {
          session.startTransaction();
          const exists = await Deposits.findOne({
            userId: userToUpdate.userId,
            betId: bet._id,
            amount: -loosingAmount,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          });
          if (exists) {
            console.log('=====================handleLosingBet exists=====================');
            console.log(bet._id, bet.status);
            console.log('=====================handleLosingBet exists=====================');
            await Bets.updateOne(
              { _id: bet._id },
              {
                status: 0,
                updatedAt: new Date().getTime()
              }
            );
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ 
              userId: bet.userId,
              betSession: bet.betSession,
              marketId: bet.marketId
  
  
            },{ session });
            return;
          }
          const user_prev_balance = userToUpdate.balance;
          const user_prev_availableBalance = userToUpdate.availableBalance;
          const user_prev_exposure = userToUpdate.exposure;

          const updatedBalance = Number((userToUpdate.balance - loosingAmount));
          const updatedClientPL = Number((userToUpdate.clientPL - loosingAmount));
          let userToUpdateAvailableBalance = -loosingAmount;
          let addExposureAmount = 0;
          if (bet.calculateExp === true) {
            userToUpdateAvailableBalance = Number((userToUpdateAvailableBalance + Number(bet.exposureAmount)));
            addExposureAmount = Number(bet.exposureAmount);
            calculatedExp = 1;
          }
          const expAmount = Number((userToUpdate.exposure + addExposureAmount));
          const updatedAvailableBalance = Number(userToUpdate.availableBalance + Number(userToUpdateAvailableBalance));
          let expPositiveData
          expPositiveData = await expPositive.findOne({ userId:userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
              
          if(expPositiveData && bet.calculateExp === true){
            //console.log("winningsShareAmount=============================================>",winningsShareAmount);
            
            await expPositive.updateOne(
              {
                userId:userId,betId:bet._id.toString()
              },
              {
                expReleased: addExposureAmount,
                updatedAt:Date.now(),
                expReleasedC:expPositiveData.expCaptured,
                diff: -loosingAmount,
                BFavailableBalance: userToUpdate.availableBalance,
                AFavailableBalance: userToUpdate.availableBalance,
                isUsed:1,
                expAfterRelease:userToUpdate.exposure  + Math.abs(expPositiveData.expCaptured)
                
              },
              { session }
            );
            availableBalance2  = userToUpdate.availableBalance
              
		  await User.updateOne(
            {
              userId: userId,
              isDeleted: false
            },
            {
              balance: updatedBalance,
              clientPL: updatedClientPL,
              exposure: expAmount,
              availableBalance2:availableBalance2,
              tempExposure:userToUpdate.tempExposure + Math.abs(expPositiveData.expCaptured),
              availableBalance: updatedAvailableBalance
            },{session}
          );
          }
         
          await User.updateOne(
            {
              userId: userId,
              isDeleted: false
            },
            {
              balance: updatedBalance,
              clientPL: updatedClientPL,
              exposure: expAmount,
              
              
              availableBalance: updatedAvailableBalance
            },{session}
          );
        
		  
          const lastMaxWithdraw = await Deposits.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });
          
		  await Deposits.create([{
            userId: userToUpdate.userId,
            description: `Event (${bet.event}) Runner (${bet.runnerName})`,
            amount: -loosingAmount,
            balance: lastMaxWithdraw ? lastMaxWithdraw.balance - loosingAmount : -loosingAmount,
            availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - loosingAmount : -loosingAmount,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - loosingAmount : loosingAmount,
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            createdBy: 0,
            cashOrCredit: 'Bet',
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId,
            betId: bet._id.toString(),
            betType: bet.type,
            betDateTime: bet.betTime,
            date: new Date().getTime(),
            createdAt: formattedDate,
            betSession: bet.betSession,
            roundId: bet.roundId,
            addedExpoisureAmount: addExposureAmount,
            UserPrevexposure: userToUpdate.exposure,
            UpdatedExposure: expAmount,
       

            

            

            calculateExp:bet.calculateExp,
            
          }],{session});
		  
		  
          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: { $in: parentUserIds },
            isDeleted: false
          }).sort({ userId: -1 });
          if (!parentUser) {
            console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
            return;
          } else {
            const remainingAmount = Number(bet.winningAmount);
            const TotalLoosingAmount = Number(bet.loosingAmount);
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            let commissionFrom = userToUpdate.userId;
            let upMovingAmount = TotalLoosingAmount;
            
            let runnersPosition = bet.runnersPosition;
            highestAmount = Math.max(...runnersPosition.map(runner => runner.position));

            for (const user of parentUser) {
              let expPositiveDataP;
              expPositiveDataP = await expPositive.findOne({ userId:user.userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
            
             
              const totalExpoisure = Number((user.exposure + Number(((user.commission / 100) * remainingAmount))));
              const totalavailableBalance = Number((user.availableBalance + Number(((user.commission / 100) * remainingAmount + (user.commission / 100) * TotalLoosingAmount))));
              const totalBalance = Number((user.balance + Number(((user.commission / 100) * TotalLoosingAmount))));
              const totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * TotalLoosingAmount)) : 0;
              const totalClientPL = Number((user.clientPL - totalClientPLAmount));
              let winningsShareAmount = Number(((user.commission / 100) * TotalLoosingAmount));
              let UpdatedExposureAmount = user.exposure + winningsShareAmount;
              console.log("user.userId========================================>",user.userId);
              console.log("bet.calculateExp===================================",bet.calculateExp);
              
              
              if(bet.calculateExp==true){
                console.log("highestAmount========================================>",highestAmount);
                let winningsShareAmount2 = Number(((user.commission / 100) * highestAmount));
                console.log("winningsShareAmount2--------------------------------------------",winningsShareAmount2);
                console.log("user.exposure-----------------------------------------------",user.exposure);
                
                let UpdatedExposureAmount2 = user.exposure + winningsShareAmount2;
                console.log("UpdatedExposureAmount2--------------------------------------------",UpdatedExposureAmount2);
                
                 
			  
			  
			  

              
              if(expPositiveDataP){
                //console.log("winningsShareAmount=============================================>",winningsShareAmount);
                await expPositive.updateOne(
                  {
                    userId:user.userId,betId:bet._id.toString()
                  },
                  {
                    expReleased: winningsShareAmount,
                    expReleasedC:expPositiveDataP.expCaptured,
                    updatedAt:Date.now(),
                
                    diff: winningsShareAmount,
                    BFavailableBalance: user.availableBalance,
                    AFavailableBalance: user.availableBalance + Math.abs(expPositiveDataP.expCaptured) + winningsShareAmount,
                    
                    expAfterRelease:user.exposure  + Math.abs(expPositiveDataP.expCaptured),
                    
                    AbAtRelease:totalBalance + UpdatedExposureAmount
                    
                  },{session}
                );
              }
              
              
              if(expPositiveDataP.calculateExp===true && expPositiveDataP.isUsed===0){
                
                let updatetempExposure = user.tempExposure + Math.abs(expPositiveDataP.expCaptured)
                console.log("expPositiveDataP._id::::",expPositiveDataP._id,"isUsed:::::",expPositiveDataP.isUsed);
                console.log("expPositiveDataP.betId::::::::::::::::",expPositiveDataP.betId);
                console.log(":::user.tempExposure::::::::::::::::::::::::::::::::::",user.tempExposure);
                console.log("Math.abs(expPositiveDataP.expCaptured::::::::::::::::",Math.abs(expPositiveDataP.expCaptured));
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::",updatetempExposure);
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log(":::updatetempExposure::::::::::::::::::::::::::::::::::")
                console.log("-------------------------------Loosing--------------------");
                await User.updateOne(
                  {
                    _id: user?._id
                  },
                  {
                   
                   
                    tempExposure:updatetempExposure,
                    
                    availableBalance2: totalBalance + UpdatedExposureAmount2
                  },{session}
                );
              }
              await User.updateOne(
                  {
                    _id: user?._id
                  },
                  {
                    balance: totalBalance,
                    clientPL: totalClientPL,
                    exposure: UpdatedExposureAmount2,
                    
                    availableBalance: totalBalance + UpdatedExposureAmount2,
                    
                  },{session}
                );


              }else{
                console.log("Math.abs(expPositiveDataP.expCaptured)-----------handle loosing else FALSE---------");
                await User.updateOne(
                  {
                    _id: user?._id
                  },
                  {
                    balance: totalBalance,
                    clientPL: totalClientPL,
                    //exposure: UpdatedExposureAmount2,
                    //tempExposure:user.tempExposure + Math.abs(expPositiveDataP.expCaptured),
                    //availableBalance2: totalBalance + UpdatedExposureAmount2
                  },{session}
                );
              }
              
              console.log("bet.winningAmount========================================>",bet.winningAmount);
              console.log("bet.loosingAmount========================================>",bet.loosingAmount);
              console.log("totalRemainingAmount not defined in losingBetX========================================>");
              console.log("remainingAmount========================================>",remainingAmount);

              
              
              
              
             
              //
              const upLineAmount = -totalClientPLAmount;
              let amount = (user.commission / 100) * TotalLoosingAmount;
              
                
              let Dbalance = amount
              let DavailableBalance = amount;
              
              const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : - ( Math.abs(amount) + Math.abs(upLineAmount) )

              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
              
              if(lastMaxWithdraw){
                Dbalance = lastMaxWithdraw.balance + (amount)
                DavailableBalance = lastMaxWithdraw.availableBalance + (amount)
              }
              //let DavailableBalance = lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (amount) : -(amount);

              let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (amount) : -( amount );
              
              let Dcash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
              let Dcredit = lastMaxWithdraw?.credit || 0;
              let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;
              
              


              //if(bet.calculateExp==true){
              
			  await Deposits.create([{
                userId: user.userId,
                description: `Event (${bet.event}) Runner (${bet.runnerName})`,
                createdBy: 0,
                amount: amount,
                balance: Dbalance,
                availableBalance: DavailableBalance,
                maxWithdraw: DmaxWithdraw,
                cash: Dcash,
                credit: Dcredit,
                creditRemaining: DcreditRemaining,
                commissionFrom: commissionFrom,
                cashOrCredit: 'Bet',
                marketId: bet.marketId,
                sportsId: bet.sportsId,
                upLineAmount: upLineAmount,
                shareNUpline:shareNUpline,
                betId: bet._id.toString(),
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
                betSession: bet.betSession,
                roundId: bet.roundId,
                addedExpoisureAmount: Number(((user.commission / 100) * remainingAmount)),
                UserPrevexposure: user.exposure,
                UpdatedExposure: totalExpoisure,
                exposure: 'Number(((user.commission / 100) * remainingAmount))',
     
              }],{session});
			  
              upMovingAmount = 0;
              //upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount));

           // }
              commissionFrom = user.userId;

              //const betIdString = bet._id.toString();
              await CurrentPosition.deleteMany({ 
                userId: user.userId,
                betSession: bet.betSession,
                marketId: bet.marketId
    
    
              },{ session });
           


            

            let winnerRunnerData = 0;
            let SessionScore = 0;

            if (bet.isfancyOrbookmaker && bet.fancyData != null) {
              const marketInfo = await MarketIDS.findOne({
                sportID: bet.sportsId,
                marketId: bet.marketId
              });
              winnerRunnerData = marketInfo?.winnerRunnerData;
            } else if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
              const match = await Events.findById(bet.matchId);
              const marketInfo = await Sessions.findOne({
                eventId: Number(match.Id),
                sessionNo: bet.betSession
              });
              SessionScore = marketInfo?.score;
            }
            
			await Bets.updateOne(
              {
                _id: bet._id
              },
              {
                status: 0,
                position: bet.loosingAmount * -1,
                iscalculatedExp: calculatedExp,
                winnerRunnerData: winnerRunnerData,
                SessionScore: SessionScore,
                updatedAt: new Date().getTime()
              },{session}
            );
			
			
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ 
              userId: userId,
          
              marketId: bet.marketId
  
  
            },{ session });
            await CurrentPosition2.deleteMany({ 
              userId: user.userId,
              
              marketId: bet.marketId
  
  
            },{ session });
            await RunnerWiselossShares.deleteMany({ 
              userId: user.userId,
              
              marketId: bet.marketId
  
  
            },{ session });


          }
          }//end parents for loop
        }
      }
    }
    await session.commitTransaction();
    break; // Exit loop if transaction succeeds
  } catch (error) {
    console.log(error,"==============================================================================");
    if ( retries < maxRetries) {
      retries++;
      console.log(`Retrying transaction...calculations2 attempt ${retries}`);
      continue; // Retry the transaction
    } else {
      console.error('Transaction Error:', error);
      await session.abortTransaction();
      break; // Exit loop if error is not transient
    }
}finally {
  session.endSession();
}
}
}
const handleDrawBetXX = async (bet, status = 0) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;

  while (retries < maxRetries) {
    try {
    if (bet.status == 1 && bet.calculateExp == true) {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const totalRemainingAmount = Number(bet.winningAmount);
        const userId = bet.userId;
        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });
        if (!userToUpdate) {
          console.error('Error: User Not Found Location:(_handle draw bet)');
          return;
        } else {
          const user_prev_balance = userToUpdate.balance;
          const user_prev_availableBalance = userToUpdate.availableBalance;
          const user_prev_exposure = userToUpdate.exposure;

          const updatedUserAvlBalance = Number((userToUpdate.availableBalance + Number(bet.exposureAmount)));
          const updatedUserExp = Number((userToUpdate.exposure + Number(bet.exposureAmount)));

          if (bet.calculateExp === true) {

            let expPositiveData;
          expPositiveData = await expPositive.findOne({ userId:userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
           

            await expPositive.updateOne(
              {
                userId:userId,betId:bet._id.toString()
              },
              {
                expReleased: expPositiveData.expCaptured,
                expReleasedC:expPositiveData.expCaptured,
                updatedAt:Date.now(),
                 
                  diff: 0,
                  BFavailableBalance: userToUpdate.availableBalance,
                  AFavailableBalance: userToUpdate.availableBalance + Math.abs(expPositiveData.expCaptured),

                expAfterRelease:userToUpdate.exposure  + Math.abs(expPositiveData.expCaptured),
                isUsed:1
                
              },
              { session }
            );


            
            calculatedExp = 1;
            
			await User.updateOne(
              {
                userId: userId,
                isDeleted: false
              },
              {
                availableBalance: updatedUserAvlBalance,
                exposure: updatedUserExp
              },{session}
            );
			
          }

          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: { $in: [...parentUserIds] },
            isDeleted: false
          }).sort({ role: -1 });
          if (!parentUser) {
            console.error(' Error : Parent User Not Found Location:(_handle Draw bet ) ');
            return;
          } else {
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            for (const user of parentUser) {
              const amountToBeAddedExp = Number((user.exposure + Number(((user.commission / 100) * totalRemainingAmount))));
              const amountToBeAddedAvlBalance = Number((user.availableBalance + Number(((user.commission / 100) * totalRemainingAmount))));
              


              let expPositiveDataP;
          expPositiveData = await expPositive.findOne({ userId:userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
           

            await expPositive.updateOne(
              {
                userId:userId,betId:bet._id.toString()
              },
              {
                expReleased: expPositiveDataP.expCaptured,
                expReleasedC:expPositiveDataP.expCaptured,
                updatedAt:Date.now(),
                 
                  diff: 0,
                  BFavailableBalance: user.availableBalance,
                  AFavailableBalance: user.availableBalance + Math.abs(expPositiveDataP.expCaptured),

                expAfterRelease:user.exposure  + Math.abs(expPositiveDataP.expCaptured)
                
              },
              { session }
            );



			  await User.updateOne(
                {
                  _id: user._id
                },
                {
                  exposure: amountToBeAddedExp,
                  availableBalance: amountToBeAddedAvlBalance
                },{session}
              );
            
            }
            
			await Bets.updateOne(
              { _id: bet._id },
              {
                position: 0,
                status: status,
                iscalculatedExp: calculatedExp,
                updatedAt: new Date().getTime()
              },{session}
            );
			
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ 
              userId: bet.userId,
              betSession: bet.betSession,
              marketId: bet.marketId
  
  
            },{ session });
            const updatedUser = await User.findOne({
              userId: userId,
              isDeleted: false
            });
            const user_new_balance = updatedUser.balance;
            
          }
        }
      }
    }
    await session.commitTransaction();
    break; // Exit loop if transaction succeeds
  } catch (error) {
    console.log(error,"==============================================================================");
    if ( retries < maxRetries) {
      retries++;
      console.log(`Retrying transaction...calcuations1 attempt ${retries}`);
      continue; // Retry the transaction
    } else {
      console.error('Transaction Error:', error);
      await session.abortTransaction();
      break; // Exit loop if error is not transient
    }
  } finally {
    session.endSession();
  }
}
};


module.exports = {
  handleDrawBet,
  getAllBets,
  getEndedMatches,
  handleLosingBet,
  handleWinningBet,
  handleLosingBetX,
  handleWinningBetX,
  handleDrawBetX,
  handleLosingBetXX,
  handleWinningBetXX,
  handleDrawBetXX
};
