const Bets = require('../../../app/models/bets');
const expPositive = require("../../../app/models/ExpPositive");
const User = require('../../../app/models/user');
const { getParents, deleteExpPositives } = require('../../../app/routes/bets');
const Events = require('../../../app/models/events');
const Deposits = require('../../../app/models/deposits');
const CurrentPosition = require('../../../app/models/CurrentPosition');
const Settings = require('../../../app/models/settings');
const MarketIDS = require("../../../app/models/marketIds")
const CurrentPosition2 = require('../../../app/models/CurrentPosition2');
const RunnerWiselossShares = require('../../../app/models/RunnerWiselossShares');
const Sessions = require('../../../app/models/Session');
const mongoose = require('mongoose');
const config = {

  commissionLessSubMarkets: [2, 3, 4],
  Fancy: 7,
  BookMaker: 8,
  FigureEvenOddSmallBig: [9, 10, 34]
};


async function getAmountOfWinnerTemp(betId, selectionId, cancelled) {

  console.log(betId, selectionId, cancelled);
  console.log("\n\n\n@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
  console.log("getAmountOfWinnerTemp function called\n\n\n");

  const session = await mongoose.startSession();

  let Settings1;

  /*
  //   check if the temp job is running
  // */
  // try {
  //   Settings1 = await Settings.findOne({ settingKey: 'IsTempJobRunning', settingValue: '1' })
  // } catch (error) {
  //   console.error('Error getting settings:', error);
  // }

  // console.log(Settings1);
  // /*
  //   if running, the end the session
  // */
  // if (Settings1) {
  //   console.log("I have found 1 in settings................");
  //   session.endSession();
  //   return
  // }

  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

  if (!selectionId || selectionId === '' || selectionId === '.') {
    console.log('selectionId is null. Please check why it’s coming null.', selectionId);
    return;
  }

  const bet = await Bets.findOne({ _id: betId._id });
  const userId = bet.userId;
  const userToUpdate = await User.findOne({ userId: bet.userId, isDeleted: false });
  let calculatedExp = bet.exposureAmount;

  if (!userToUpdate) {
    console.error('Error: user not found Location:(_handle winning bet)');
    return;
  }

  const exists = await Deposits.findOne({
    userId: userToUpdate.userId,
    betId: bet._id,
    marketId: bet.marketId,
    sportsId: bet.sportsId,
    matchId: bet.matchId
  });

  if (exists) {
    return;
  }

  let lowestPosition;
  const runnersPosition = bet.runnersPosition;
  let winnerRunner;
  let selectedRunnerAmount = 0;
  let winningAmount




  if (bet.subMarketId == '7') {
    //for fancies only
    lowestPosition = runnersPosition.reduce((min, entry) => entry.position < min.position ? entry : min).position;
    const highestRunner = runnersPosition.reduce((max, entry) => entry.runner > max.runner ? entry : max);
    const lowestRunner = runnersPosition.reduce((min, entry) => entry.runner < min.runner ? entry : min);
    const resultData = Number(bet.resultData);

    /* find winning amount */
    if (resultData > highestRunner.runner) {
      winningAmount = highestRunner.position;
    } else if (resultData < lowestRunner.runner) {
      winningAmount = lowestRunner.position;
    } else {
      const lowerRunners = runnersPosition.filter(entry => entry.runner < resultData);
      const higherRunners = runnersPosition.filter(entry => entry.runner > resultData);

      const closestLower = lowerRunners.reduce((prev, curr) =>
        Math.abs(curr.runner - resultData) < Math.abs(prev.runner - resultData) ? curr : prev,
        { runner: -Infinity, position: null }
      );

      const closestHigher = higherRunners.reduce((prev, curr) =>
        Math.abs(curr.runner - resultData) < Math.abs(prev.runner - resultData) ? curr : prev,
        { runner: Infinity, position: null }
      );


      if (closestLower.position === closestHigher.position) {
        winningAmount = closestHigher.position

      }
      if (closestLower.position == closestHigher.position) {
        winningAmount = closestHigher.position
      }

    }
    /* finding winning amount ended */

  } else {
    //for all other markets
    lowestPosition = runnersPosition.reduce((min, entry) => entry.amount < min.amount ? entry : min).amount;
    runnersPosition?.forEach(winner => { // select runner's amount and winnerRuner
      if (winner.runner === selectionId) {
        selectedRunnerAmount = winner.amount;
        winnerRunner = winner.runner;
      }
    });

    winningAmount = selectedRunnerAmount;
  }

  let updateavailableBalance

  let updateUserExposure
  let UpdatedclientPL
  let UpdatedBalance

  updateUserExposure = Number(userToUpdate.exposure + Math.abs(lowestPosition));
  updateavailableBalance = Number(userToUpdate.availableBalance);
  UpdatedclientPL = Number(userToUpdate.clientPL);
  UpdatedBalance = Number(userToUpdate.balance);
  let expCaptured = Math.abs(lowestPosition);

  if (cancelled === 1) {
    winningAmount = 0;
    updatedBetStatus = 2;
  }

  if (winningAmount > 0) {
    const commissionAmount = 0.02 * winningAmount;
    updateavailableBalance = Number(userToUpdate.availableBalance + expCaptured + winningAmount);
    UpdatedclientPL = Number(userToUpdate.clientPL + (winningAmount));
    UpdatedBalance = Number(userToUpdate.balance + (winningAmount));
  } else if (winningAmount < 0) {
    UpdatedclientPL = Number(userToUpdate.clientPL + (winningAmount));
    UpdatedBalance = Number(userToUpdate.balance + (winningAmount));
    updateavailableBalance = Number(userToUpdate.availableBalance + expCaptured + (winningAmount));
  } else if (winningAmount === 0) {
    updateavailableBalance = Number(userToUpdate.availableBalance + expCaptured);
  }



  while (retries < maxRetries) {
    try {
      /*
          set the flag as 1, that means temp job is running
        */
      // await Settings.findOneAndUpdate({ settingKey: 'IsTempJobRunning' }, { $set: { settingValue: '1' } }, { session });
      await session.startTransaction();

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

      await Deposits.create([{
        userId: userToUpdate.userId,
        description: `Event (${bet.event}) Runner (${bet.runnerName})`,
        amount: winningAmount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance + winningAmount : winningAmount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + winningAmount : winningAmount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + winningAmount : winningAmount,
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
        roundId: bet.marketId,
        addedExpoisureAmount: 0,
        UserPrevexposure: 0,
        UpdatedExposure: 0,
        calculateExp: bet.calculateExp,
      }], { session });

      const parentUserIds = await getParents(userToUpdate.userId);
      const parentUser = await User.find({
        userId: { $in: [...parentUserIds] },
        isDeleted: false
      }).sort({ userId: -1 });

      if (!parentUser) {
        console.error('Error: Parent Users Not Found Location:(_handle losing bet)');
        return;
      } else {
        let prev = 0;
        for (const user of parentUser) {
          let current = user.downLineShare;
          user['commission'] = current - prev;
          prev = current;
        }

        for (const user of parentUser) {
          const existsP = await Deposits.findOne({
            userId: user.userId,
            betId: bet._id,
            commissionFrom: userId,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          });

          if (existsP) {
            continue;
          }

          await SettleParents(user, bet, winningAmount, session, formattedDate, cancelled); // have to be checked: what is userToupdate
        }

        // Final settlement for parents
        // await SettleParents(userToUpdate, bet, winningAmount, session, formattedDate, cancelled);
      }

      // Update Bets with the status and winner data
      let winnerRunnerData = 0;

      await Bets.updateMany(
        {
          marketId: bet.marketId,
          userId: bet.userId,
          betSession: bet.betSession,
          eventId: bet.eventId,
          sportsId: bet.sportsId
        },
        {
          status: 0,
          position: Number(bet.winningAmount),
          iscalculatedExp: calculatedExp,
          winnerRunnerData: winnerRunnerData,
          updatedAt: new Date().getTime()
        },
        { session }
      );

      /*
          set the flag as 0, that means temp job is stopped
        */
      // await Settings.findOneAndUpdate({ settingKey: 'IsTempJobRunning' }, { $set: { settingValue: '0' } }, { session });
      // Commit the transaction
      await session.commitTransaction();
      break; // Exit loop if transaction succeeds
    } catch (error) {
      if (retries < maxRetries) {
        retries++;
        console.log(`Retrying transaction... attempt ${retries}`, error);
        continue; // Retry the transaction
      } else {
        console.error('Transaction Error:', error);
        await session.abortTransaction(); // Abort transaction on failure
        break; // Exit loop after max retries
      }
    } finally {
      session.endSession();  // Always end the session after commit or abort
    }
  }
}


async function getAmountOfWinnerTempUpdated(betId, selectionId) {






  if (!selectionId || selectionId == '' || selectionId == '.') {
    //console.error('Error: User Not Found Location:(_handle losing bet)');
    return;
  }

  const mongoose = require('mongoose');

  const session = await mongoose.startSession();

  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;
  while (retries < maxRetries) {
    try {
      session.startTransaction();

      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      const bet = await Bets.findOne({
        _id: betId._id
      });
      const userToUpdate = await User.findOne({
        userId: bet.userId,
        isDeleted: false
      });
      if (!userToUpdate) {
        console.error('Error: User Not Found');
        return;
      }
      //console.log("userToUpdate----------------------------------------",userToUpdate.availableBalance);
      //console.log("bet----------------------------------------",bet);

      let user_AvailableBalance = userToUpdate.availableBalance;
      let userPrevClientPL = userToUpdate.clientPL;
      let user_Exposure = userToUpdate.exposure;
      let AmountAddedBacktoUserAB = 0;
      let TotalWin = 0;
      let TotalLose = 0;
      let calculatedExp = bet.exposureAmount;
      let betexposureAmount = bet.exposureAmount;
      TotalLose = betexposureAmount;
      let userId = bet.userId;
      let selectedRunnerAmount;



      const runnerPosition = bet?.runnersPosition
      let amount = 0
      let winnerRunner = '';
      runnerPosition?.forEach(winner => {


        if (winner.runner == selectionId) {
          selectedRunnerAmount = winner.amount
          winnerRunner = winner.runner
        }



      });

      AmountAddedBacktoUserAB = betexposureAmount + selectedRunnerAmount  // 400 + ( -45 ) = 355, in case of winning we will set it zero
      TotalWin = Number(AmountAddedBacktoUserAB); // in case of winning, we will keep it same

      let diff = selectedRunnerAmount;
      let users_exposureNewUpdated = user_Exposure + TotalLose;
      let updatedAvailableBalance = user_AvailableBalance;
      updatedAvailableBalance = TotalWin + updatedAvailableBalance;
      let expPositiveData;

      expPositiveData = await expPositive.findOne({ userId: userToUpdate.userId, betId: bet._id.toString(), calculateExp: true }).sort({ _id: -1 });
      let availableBalance2 = 0;
      if (diff > 0) {
        availableBalance2 = Math.abs(expPositiveData.expCaptured) + diff + userToUpdate.availableBalance
      }
      if (diff < 0) {
        availableBalance2 = userToUpdate.availableBalance
      }
      if (diff == 0) {
        availableBalance2 = Math.abs(expPositiveData.expCaptured) + userToUpdate.availableBalance
      }
      await User.updateOne(
        {
          userId: bet.userId,
          isDeleted: false
        },
        {
          //availableBalance2: userToUpdate.balance + diff,
          balance: userToUpdate.balance + diff,
          clientPL: userPrevClientPL + diff,
          exposure: users_exposureNewUpdated,
          tempExposure: userToUpdate.tempExposure + Math.abs(expPositiveData.expCaptured),
          availableBalance2: availableBalance2,
          availableBalance: updatedAvailableBalance
        },
        { session }
      );

      const userExpCheck = await User.findOne({ userId: bet.userId, exposure: { $gt: 0 } });


      const lastMaxWithdraw = await Deposits.findOne({ userId: bet.userId }).sort({ _id: -1 });
      let lastWithdrawalRow_AvailableBalance = lastMaxWithdraw.availableBalance;
      let updatedDepositsAvailableBalance = lastWithdrawalRow_AvailableBalance + diff;
      await Deposits.create([{
        userId: userToUpdate.userId,
        description: `Event (${bet.event}) Runner (${bet.runnerName})`,
        amount: diff,
        balance: lastMaxWithdraw.balance + diff,
        availableBalance: updatedDepositsAvailableBalance,
        maxWithdraw: lastMaxWithdraw.maxWithdraw,
        maxWithdraw2: updatedDepositsAvailableBalance,
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        createdBy: 0,
        cashOrCredit: 'Bet',
        marketId: bet.marketId,
        sportsId: bet.sportsId,
        matchId: bet.matchId,
        subMarketId: bet.subMarketId,
        betId: bet._id.toString(),
        betType: bet.type,
        betDateTime: bet.betTime,
        date: new Date().getTime(),
        createdAt: formattedDate,
        betSession: bet.betSession,
        roundId: bet.marketId,
        addedExpoisureAmount: 0,
        UserPrevexposure: 0,
        UpdatedExposure: 0,



        calculateExp: bet.calculateExp,

      }],
        { session });
      if (expPositiveData) {
        await expPositive.updateOne(
          {
            userId: userToUpdate.userId, betId: bet._id.toString(), roundId: bet.marketId
          },
          {

            expReleased: TotalLose,
            expAfterRelease: users_exposureNewUpdated,
            expReleasedC: Math.abs(expPositiveData.expCaptured),
            updatedAt: Date.now(),
            diff: diff,
            BFavailableBalance: userToUpdate.availableBalance,
            AFavailableBalance: availableBalance2,

            AbAtRelease: updatedAvailableBalance,
            ABForWinAmount: TotalWin,

          },
          { session }
        );
      }

      /// Follownig are assignments for commissions, downlines, uplines etc to parents...

      const parentUserIds = await getParents(userToUpdate.userId);
      const parentUser = await User.find({
        userId: { $in: parentUserIds },
        isDeleted: false
      }).sort({ userId: -1 });
      if (!parentUser) {
        console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
        return;
      } else {

        let NeutralselectedRunnerAmount = Math.abs(diff);
        let upMovingAmount = NeutralselectedRunnerAmount;
        let totalRemainingAmount = diff;
        let remainingAmount = NeutralselectedRunnerAmount;
        let commissionAmount = 0;
        let upMovingCommAmount = 0;
        let callectiveUpline = 0;
        //console.log("-------------------------------------------------------------------------------------------------===",totalRemainingAmount);

        let prev = 0;
        for (const user of parentUser) {
          let current = user.downLineShare;
          user['commission'] = current - prev;
          prev = current;
        }
        let commissionFrom = userToUpdate.userId;
        for (const user of parentUser) {
          let expPositiveDataP;
          expPositiveDataP = await expPositive.findOne({ userId: user.userId, betId: bet._id.toString(), calculateExp: true }).sort({ _id: -1 });
          if (expPositiveDataP && expPositiveDataP.calculateExp === true) {
            let prevrunnersPosition = false;
            let runnersPosition = bet.runnersPosition;
            let highestAmount = Math.max(...runnersPosition.map(runner => runner.amount));
            if (bet.isFancyOrBookMaker == true && bet.fancyData != null) {
              runnersPosition = bet.runnersPosition;
              highestAmount = Math.max(...runnersPosition.map(runner => runner.position));
            }
            let winningsShareAmount = Number(((user.commission / 100) * highestAmount));
            let loosingShareAmount = Number(((user.commission / 100) * remainingAmount));

            let UpdatedExposureAmount = user.exposure + winningsShareAmount;
            let UpdatedAvailableBalance = user.availableBalance;

            let totalClientPLAmount;
            let userBalance;
            let totalBalance;
            let totalClientPL;
            let upLineAmount = 0;




            if (diff < 0) {

              UpdatedAvailableBalance = user.availableBalance + winningsShareAmount;
              UpdatedAvailableBalance = UpdatedAvailableBalance + loosingShareAmount
              totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount)) : 0;
              //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .
              userBalance = totalClientPLAmount;
              totalBalance = Number((user.balance + Number(((user.commission / 100) * remainingAmount))));
              totalClientPL = Number((user.clientPL + (-totalClientPLAmount)));
              upLineAmount = -totalClientPLAmount;
              availableBalance2 = Math.abs(expPositiveDataP.expCaptured) + user.availableBalance
            } else {
              availableBalance2 = Math.abs(expPositiveDataP.expCaptured) + diff + user.availableBalance
              totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount)) : 0;
              //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .

              userBalance = totalClientPLAmount;
              totalBalance = Number((user.balance - Number(((user.commission / 100) * remainingAmount))));
              totalClientPL = Number((user.clientPL + totalClientPLAmount));
              upLineAmount = totalClientPLAmount;

            }
            let amount = -(user.commission / 100) * totalRemainingAmount;
            if (expPositiveDataP && expPositiveDataP.calculateExp == true) {
              await expPositive.updateOne(
                {
                  userId: user.userId, betId: bet._id.toString()
                },
                {
                  expReleased: winningsShareAmount,
                  expAfterRelease: UpdatedExposureAmount,
                  updatedAt: Date.now(),
                  diff: amount,
                  BFavailableBalance: user.availableBalance,
                  AFavailableBalance: totalBalance + UpdatedExposureAmount,
                  expReleasedC: Math.abs(expPositiveDataP.expCaptured),
                  AbAtRelease: totalBalance + UpdatedExposureAmount,
                  isUsed: 1

                },
                { session }
              );
            }



            if (expPositiveDataP.calculateExp == true && expPositiveDataP.isUsed === 0) {

              let updatetempExposure = user.tempExposure + Math.abs(expPositiveDataP.expCaptured);
              await User.updateOne(
                {
                  _id: user?._id
                },
                {


                  tempExposure: updatetempExposure,
                  availableBalance2: totalBalance + UpdatedExposureAmount,
                }, { session }
              );
            }



            await User.updateOne(
              {
                userId: user.userId,
                isDeleted: false
              },
              {
                balance: totalBalance,//P/L Downline
                exposure: UpdatedExposureAmount,

                availableBalance: totalBalance + UpdatedExposureAmount,
                clientPL: totalClientPL //Balance Upline
              },
              { session }
            );
            let Dbalance = amount
            let DavailableBalance = amount;

            const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : - (Math.abs(amount) + Math.abs(upLineAmount))

            const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });

            if (lastMaxWithdraw) {
              Dbalance = lastMaxWithdraw.balance + (amount)
              DavailableBalance = lastMaxWithdraw.availableBalance + (amount)
            }
            let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (amount) : -(amount);

            let Dcash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
            let Dcredit = lastMaxWithdraw?.credit || 0;
            let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;


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
              marketId: bet.marketId,
              cashOrCredit: 'Bet',
              commissionFrom: commissionFrom,
              sportsId: bet.sportsId,
              shareNUpline: shareNUpline,
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
              UpdatedExposure: UpdatedExposureAmount,
              exposure: 'lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount',

            }],
              { session });



            upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount));

            if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker && TotalWin > TotalLose) {
              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
              let Camount = (2 / 100) * ((user.commission / 100) * totalRemainingAmount);



              await Deposits.create([{
                userId: user.userId,
                description: `Commission From Event (${bet.event}) Runner (${bet.runnerName})`,
                createdBy: 0,
                commissionFrom: commissionFrom,
                amount: Camount,
                balance: Dbalance,
                availableBalance: DavailableBalance,
                maxWithdraw: DmaxWithdraw,
                cash: Dcash,
                credit: Dcredit,
                creditRemaining: DcreditRemaining,

                cashOrCredit: 'Commission',
                betId: bet._id.toString(),
                marketId: bet.marketId,
                subMarketId: bet.subMarketId,
                sportsId: bet.sportsId,
                shareNUpline: shareNUpline,
                upLineAmount: upLineAmount,
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
                betSession: bet.betSession,
                roundId: bet.marketId
              }],
                { session });

              upMovingCommAmount = Number((upMovingCommAmount - (user.commission / 100) * commissionAmount));
            }
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({
              userId: user.userId,

              marketId: bet.marketId


            }, { session });

            //commissionFrom = user.userId;
          }//calculateExp true

          await CurrentPosition2.deleteMany({
            userId: user.userId,

            marketId: bet.marketId


          }, { session });

          await RunnerWiselossShares.deleteMany({
            userId: user.userId,

            marketId: bet.marketId


          }, { session });

        }//parents loop

        let winnerRunnerData = 0;
        let SessionScore = 0;
        if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
          const match = await Events.findById(bet.matchId);
          const marketInfo = await Sessions.findOne({
            eventId: Number(match.Id),
            sessionNo: bet.betSession
          });
          SessionScore = marketInfo?.score;
        }
        await Bets.updateMany(
          {
            marketId: bet.marketId,
            userId: bet.userId,
            betSession: bet.betSession,
            eventId: bet.eventId,
            sportsId: bet.sportsId
          },
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

      }//parents else

      await session.commitTransaction();
      break; // Exit loop if transaction succeeds
    } catch (error) {


      if (retries < maxRetries) {
        retries++;
        console.log(`Retrying transaction...helper1 attempt A ${retries}`, error);
        continue; // Retry the transaction
      } else {
        console.error('Transaction Error:', error);
        await session.abortTransaction();
        break; // Exit loop if error is not transient
      }



    } finally {
      session.endSession();
    }
  }//end while loop

}

async function getAmountOfWinnerFigures(betId, selectionId, cancelled) {

  //selectionId = selectionId.replace(/\s/g, '');
  if (!selectionId || selectionId == '' || selectionId == '.') {
    console.log('selectio nid is null. please check why its coming null......................', selectionId);
    // return;
  }
  const bet = await Bets.findOne({ _id: betId._id });
  const userToUpdate = await User.findOne({ userId: bet.userId, isDeleted: false });

  if (!userToUpdate) {
    console.error('Error: User Not Found');
    return;
  }
  const exists = await Deposits.findOne({
    userId: userToUpdate.userId,
    betId: bet._id
  });
  if (exists) {

    return;
  }
  //console.log("Reached inside the function..............................");
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  const userId = bet.userId;
  let lowestPosition
  const runnersPosition = bet.runnersPosition;
  const winnerRunner = '';
  if (bet.subMarketId == '7') {
    lowestPosition = runnersPosition.reduce((min, entry) => entry.position < min.position ? entry : min).position;
  } else {
    lowestPosition = runnersPosition.reduce((min, entry) => entry.amount < min.amount ? entry : min).amount;
  }

  runnersPosition?.forEach(winner => {
    if (winner.runner == selectionId) {
      selectedRunnerAmount = winner.amount;
      winnerRunner = winner.runner;
    }
  });
  let winningAmount = selectedRunnerAmount
  let updateavailableBalance

  let updateUserExposure
  let UpdatedclientPL
  let UpdatedBalance

  updateUserExposure = Number(userToUpdate.exposure + Math.abs(lowestPosition))
  updateavailableBalance = Number(userToUpdate.availableBalance)
  UpdatedclientPL = Number(userToUpdate.clientPL)
  UpdatedBalance = Number(userToUpdate.balance)
  let expCaptured = 0

  expCaptured = Math.abs(lowestPosition)
  if (cancelled == 1) {
    winningAmount = 0
    updatedBetStatus = 2
  }
  if (winningAmount > 0) {
    commissionAmount = 0.02 * winningAmount
    updateavailableBalance = Number(userToUpdate.availableBalance + expCaptured + winningAmount)
    UpdatedclientPL = Number(userToUpdate.clientPL + (winningAmount))
    UpdatedBalance = Number(userToUpdate.balance + (winningAmount))

  } else if (winningAmount < 0) {


    UpdatedclientPL = Number(userToUpdate.clientPL + (winningAmount))
    UpdatedBalance = Number(userToUpdate.balance + (winningAmount))
    updateavailableBalance = Number(userToUpdate.availableBalance + expCaptured + (winningAmount))

  } else if (winningAmount == 0) {
    updateavailableBalance = Number(userToUpdate.availableBalance + expCaptured)
  }

  while (retries < maxRetries) {
    try {
      session.startTransaction();
      try {
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
          }
          , { session }
        );
      } catch (error) {
      }


      const lastMaxWithdraw = await Deposits.findOne({ userId: bet.userId }).sort({ _id: -1 });
      await Deposits.create(
        [{
          userId: userToUpdate.userId,
          description: `Event (${bet.event}) Runner (${bet.runnerName})`,
          amount: winningAmount,
          balance: lastMaxWithdraw ? lastMaxWithdraw.balance + winningAmount : winningAmount,
          availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + winningAmount : winningAmount,
          maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + winningAmount : winningAmount,
          cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
          credit: lastMaxWithdraw?.credit || 0,
          creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
          createdBy: 0,
          cashOrCredit: 'Bet',
          marketId: bet.marketId,
          subMarketId: bet.subMarketId,
          sportsId: bet.sportsId,
          matchId: bet.matchId,
          betId: bet._id.toString(),
          betType: bet.type,
          betDateTime: bet.betTime,
          date: new Date().getTime(),
          createdAt: formattedDate,
          betSession: bet.betSession,
          roundId: bet.marketId,
          addedExpoisureAmount: 0,
          UserPrevexposure: 0,
          UpdatedExposure: 0,
          calculateExp: bet.calculateExp
        }],
        { session }
      );
      const parentUserIds = await getParents(userToUpdate.userId);
      const parentUser = await User.find({
        userId: { $in: parentUserIds },
        isDeleted: false
      }).sort({ userId: -1 });

      if (!parentUser) {
        console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
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

          const existsP = await Deposits.findOne({
            userId: user.userId,
            betId: bet._id,
            commissionFrom: commissionFrom,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          });
          if (existsP) {


            continue;
          }

          await SettleParents(user, bet, winningAmount, session, formattedDate, cancelled)


        }//loop of parents
      }//else of parents..




      let winnerRunnerData = 0;
      let SessionScore = 0;
      if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
        const match = await Events.findById(bet.matchId);
        const marketInfo = await Sessions.findOne({
          eventId: Number(match.Id),
          sessionNo: bet.betSession
        });
        SessionScore = marketInfo?.score;
      }
      await Bets.updateMany(
        {
          marketId: bet.marketId,
          userId: bet.userId,
          betSession: bet.betSession,
          eventId: bet.eventId,
          sportsId: bet.sportsId
        },
        {
          status: 0,
          position: Number(bet.winningAmount),

          winnerRunnerData: winnerRunnerData,
          SessionScore: SessionScore,
          updatedAt: new Date().getTime()
        }, { session }
      );


      await CurrentPosition.deleteMany({
        userId: userToUpdate.userId,
        betSession: bet.betSession,
        marketId: bet.marketId


      }, { session });





      await session.commitTransaction();
      break; // Exit loop if transaction succeeds
    } catch (error) {

      if (retries < maxRetries) {
        retries++;
        console.log(`Retrying transaction...helper2 attempt ${retries}`);
        console.error('Transaction Error:', error);
        continue; // Retry the transaction
      } else {
        console.error('Transaction Error:', error);
        await session.abortTransaction();
        break; // Exit loop if error is not transient
      }
    } finally {
      session.endSession();
    }
  }//end while loop
}

async function getAmountOfWinnerFiguresUpdated(betId, selectionId) {

  //selectionId = selectionId.replace(/\s/g, '');
  if (!selectionId || selectionId == '' || selectionId == '.') {
    console.log('selection id is null. please check why its coming null......................', selectionId);
    // return;
  }
  //console.log("Reached inside the function..............................");
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;

  while (retries < maxRetries) {
    try {
      session.startTransaction();

      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;

      const bet = await Bets.findOne({ _id: betId._id });
      const userToUpdate = await User.findOne({ userId: bet.userId, isDeleted: false });


      if (!userToUpdate) {
        console.error('Error: User Not Found');
        return;
      }



      let user_AvailableBalance = userToUpdate.availableBalance;
      let userPrevBalance = userToUpdate.balance;
      let userPrevClientPL = userToUpdate.clientPL;
      let user_Exposure = userToUpdate.exposure;
      let AmountAddedBacktoUserAB = 0;
      let TotalWin = 0;
      let TotalLose = 0;
      let calculatedExp = bet.exposureAmount;
      let betexposureAmount = bet.exposureAmount;
      TotalLose = betexposureAmount;
      let userId = bet.userId;

      const runnerPosition = bet?.runnersPosition;
      var amount = 0;
      var winnerRunner = '';
      runnerPosition?.forEach(winner => {
        if (winner.runner == selectionId) {
          selectedRunnerAmount = winner.amount;
          winnerRunner = winner.runner;
        }
      });

      AmountAddedBacktoUserAB = betexposureAmount + selectedRunnerAmount;
      TotalWin = Number(AmountAddedBacktoUserAB);

      let diff = selectedRunnerAmount;
      let users_exposureNewUpdated = user_Exposure + TotalLose;
      let updatedAvailableBalance = user_AvailableBalance;
      updatedAvailableBalance = TotalWin + updatedAvailableBalance;
      const lastMaxWithdraw = await Deposits.findOne({ userId: bet.userId }).sort({ _id: -1 });
      let lastWithdrawalRow_AvailableBalance = lastMaxWithdraw.availableBalance;
      let updatedDepositsAvailableBalance = lastWithdrawalRow_AvailableBalance + diff;




      console.log("userId:", userToUpdate.userId, "------betId:", bet._id.toString(), "======marketId:", bet.marketId);
      let expPositiveData;
      expPositiveData = await expPositive.findOne({ userId: userToUpdate.userId, betId: bet._id.toString(), calculateExp: true }).sort({ _id: -1 });
      console.log("111expPositiveData............");


      console.log("2222e............");

      let availableBalance2 = 0;
      if (diff > 0) {
        availableBalance2 = diff + userToUpdate.availableBalance
      }
      if (diff < 0) {
        availableBalance2 = userToUpdate.availableBalance
      }
      if (diff == 0) {
        availableBalance2 = userToUpdate.availableBalance
      }



      await expPositive.updateOne(
        {
          userId: userToUpdate.userId, betId: bet._id.toString()
        },
        {
          expReleased: TotalLose,
          expAfterRelease: users_exposureNewUpdated,
          updatedAt: Date.now(),
          diff: diff,
          BFavailableBalance: userToUpdate.availableBalance,
          AFavailableBalance: availableBalance2,
          //expReleasedC : Math.abs(expPositiveData.expCaptured),
          AbAtRelease: updatedAvailableBalance

        }
      );

      await User.updateOne(
        { userId: bet.userId, isDeleted: false },
        {
          //availableBalance2: userToUpdate.balance + diff,
          balance: userToUpdate.balance + diff,
          clientPL: userPrevClientPL + diff,
          exposure: users_exposureNewUpdated,
          //tempExposure:userToUpdate.tempExposure + Math.abs(expPositiveData.expCaptured),
          availableBalance2: availableBalance2,
          availableBalance: updatedAvailableBalance
        },
        { session }
      );



      await Deposits.create(
        [{
          userId: userToUpdate.userId,
          description: `Event (${bet.event}) Runner (${bet.runnerName})`,
          amount: diff,
          balance: lastMaxWithdraw.balance + diff,
          availableBalance: updatedDepositsAvailableBalance,
          maxWithdraw: lastMaxWithdraw.maxWithdraw,
          maxWithdraw2: updatedDepositsAvailableBalance,
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
          roundId: bet.marketId,
          addedExpoisureAmount: 0,
          UserPrevexposure: 0,
          UpdatedExposure: 0,
          calculateExp: bet.calculateExp
        }],
        { session }
      );







      const parentUserIds = await getParents(userToUpdate.userId);
      const parentUser = await User.find({
        userId: { $in: parentUserIds },
        isDeleted: false
      }).sort({ userId: -1 });

      if (!parentUser) {
        console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
        return;
      } else {
        let NeutralselectedRunnerAmount = Math.abs(diff);
        console.log("NeutralselectedRunnerAmount-----------------outside-----------------", NeutralselectedRunnerAmount);
        let totalRemainingAmount = diff;
        let remainingAmount = NeutralselectedRunnerAmount;
        console.log("remainingAmount-----------------outside-----------------", remainingAmount);
        let commissionAmount = 0;


        let prev = 0;
        for (const user of parentUser) {
          let current = user.downLineShare;
          user['commission'] = current - prev;
          prev = current;
        }

        let commissionFrom = userToUpdate.userId;

        for (const user of parentUser) {
          const existsP = await Deposits.findOne({
            userId: user.userId,
            betId: bet._id,
            commissionFrom: commissionFrom,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          });
          if (existsP) {


            continue;
          }

          await SettleParents(user, bet, diff, session, formattedDate, 0)




          //}
        }//loop of parents
      }//else of parents..










      await session.commitTransaction();
      break; // Exit loop if transaction succeeds
    } catch (error) {

      if (retries < maxRetries) {
        retries++;
        console.log(`Retrying transaction...helper2 attempt ${retries}`);
        continue; // Retry the transaction
      } else {
        console.error('Transaction Error:', error);
        await session.abortTransaction();
        break; // Exit loop if error is not transient
      }
    } finally {
      session.endSession();
    }
  }//end while loop
}

async function returnParentExposure(bet) {


  calculatedExp = 1;
  let runnersPosition = bet.runnersPosition;

  let highestAmount = Math.max(...runnersPosition.map(runner => runner.amount));

  let pledgedAmount = Math.abs(bet.exposureAmount);

  const userToUpdate = await User.findOne({
    userId: bet.userId,
    isDeleted: false
  });

  // console.log("pledgedAmount..............",pledgedAmount);
  // console.log("bet.availableBalance..............",userToUpdate.availableBalance);
  // 
  await User.updateOne(
    {
      userId: bet.userId,
      isDeleted: false
    },
    {
      availableBalance: userToUpdate.availableBalance + pledgedAmount,
      exposure: userToUpdate.exposure + pledgedAmount
    }
  );






  const parentUserIds = await getParents(bet.userId);
  const parentUser = await User.find({
    userId: { $in: parentUserIds },
    isDeleted: false
  }).sort({ userId: -1 });
  if (!parentUser) {
    console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
    return;
  } else {


    let prev = 0;
    for (const user of parentUser) {
      let current = user.downLineShare;
      user['commission'] = current - prev;
      prev = current;
    }

    for (const user of parentUser) {

      if (bet.isfancyOrbookmaker == true && bet.fancyData !== null) {
        let runnersPosition = bet.runnersPosition;
        runnersPosition = bet.runnersPosition;
        highestAmount = Math.max(...runnersPosition.map(runner => runner.position));
      } else {

        let runnersPosition = bet.runnersPosition;
        let highestAmount = Math.max(...runnersPosition.map(runner => runner.amount));
        if (bet.isFancyOrBookMaker == true && bet.fancyData != null) {
          runnersPosition = bet.runnersPosition;
          highestAmount = Math.max(...runnersPosition.map(runner => runner.position));
        }

        let winningsShareAmount = Number(((user.commission / 100) * highestAmount));

        let UpdatedExposureAmount = user.exposure + winningsShareAmount;
        await User.updateOne(
          {
            userId: user.userId,
            isDeleted: false
          },
          {

            exposure: UpdatedExposureAmount,
            availableBalance: user.availableBalance + winningsShareAmount,

          }
        );
        await Bets.updateOne(
          { _id: bet._id },
          {
            position: 0,
            status: 2,
            iscalculatedExp: 1,
            updatedAt: new Date().getTime()
          }
        );


      }
    }

  }
}
async function casinoSettlement(betId, selectionId) {






}

async function SettleParents(user, bet, winningAmount, session, formattedDate, cancelled) {
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss", winningAmount);
  let updatedBetStatus = 0
  if (cancelled == 1) {
    winningAmount = 0
    updatedBetStatus = 2
  }

  console.log("user in => ..............", user);

  let commissionFrom = bet.userId
  let expPositiveDataP;
  console.log('bet in parentsettle------------------------', bet);
  expPositiveDataP = await expPositive.findOne({ userId: user.userId, betId: bet._id.toString(), calculateExp: true }).sort({ _id: -1 });
  let FinalShareAmount = Number(((user.commission / 100) * Math.abs(winningAmount)))
  dealersCommissionAmount = Number(((user.commission / 100) * FinalShareAmount))
  let totalExpoisure
  if (expPositiveDataP) {
    console.log("expPositiveDataP====>>>>", expPositiveDataP);
    totalExpoisure = expPositiveDataP.expCaptured;

  } else {
    totalExpoisure = FinalShareAmount
  }

  let totalBalance = user.balance;
  let totalClientPL = user.clientPL
  let totalClientPLAmount = 0
  let updatedtotalavailableBalance = Number(user.availableBalance)
  let reversedavailableBalance = user.availableBalance + totalExpoisure
  console.log("winningAmount::::", winningAmount);
  if (winningAmount > 0) {


    updatedtotalavailableBalance = Number((reversedavailableBalance - FinalShareAmount));
    totalBalance = Number((user.balance - FinalShareAmount));
    totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * winningAmount)) : 0;
    totalClientPL = Number((user.clientPL + totalClientPLAmount));



  } else if (winningAmount < 0) {
    updatedtotalavailableBalance = Number((reversedavailableBalance + FinalShareAmount));
    totalBalance = Number((user.balance + Number(((user.commission / 100) * Math.abs(winningAmount)))));
    totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * Math.abs(winningAmount))) : 0;
    totalClientPL = Number((user.clientPL - totalClientPLAmount));


  } else {
    updatedtotalavailableBalance = reversedavailableBalance

  }

  await User.updateOne(
    {
      userId: user.userId,
      isDeleted: false
    },
    {
      balance: totalBalance,

      exposure: user.exposure + totalExpoisure,
      availableBalance: updatedtotalavailableBalance,
      availableBalance2: updatedtotalavailableBalance,
      tempExposure: totalExpoisure,
      clientPL: totalClientPL
    },
    { session }
  );




  //  await expPositiveDataP.updateOne(
  //   {
  //     userId:user.userId,betId:bet._id.toString(),roundId:bet.marketId
  //   },
  //   {


  //     expReleasedC:Math.abs(expPositiveDataP.expCaptured),
  //     updatedAt:Date.now(),
  //     diff:FinalShareAmount,
  //     BFavailableBalance: user.availableBalance,
  //     AFavailableBalance:updatedtotalavailableBalance
  //   },
  //   { session }
  // );




  let upLineAmount
  console.log("winningAmount----------------------------", winningAmount);
  if (winningAmount < 0) {
    upLineAmount = -totalClientPLAmount;
    // const totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * TotalLoosingAmount)) : 0;
    // const totalClientPL = Number((user.clientPL - totalClientPLAmount));

  } else {
    upLineAmount = totalClientPLAmount;
    // const totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount)) : 0;
    // const totalClientPL = Number((user.clientPL + totalClientPLAmount));

  }


  console.log("upLineAmount------------------>>>>>", upLineAmount);
  let amount = 0;
  if (winningAmount > 0) {

    amount = -(user.commission / 100) * winningAmount;

  } else {
    amount = (user.commission / 100) * Math.abs(winningAmount);

  }

  console.log("amount------------------>>>>>", amount);
  let Dbalance = amount
  let DavailableBalance = amount;
  console.log("DavailableBalance------------------>>>>>", DavailableBalance);
  const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : - (Math.abs(amount) + Math.abs(upLineAmount))
  console.log("shareNUpline------------------>>>>>", shareNUpline);
  const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });

  if (lastMaxWithdraw) {
    Dbalance = lastMaxWithdraw?.balance + (amount)
    DavailableBalance = lastMaxWithdraw.availableBalance + (amount)
    console.log("lastMaxWithdraw------------------>>>>>", lastMaxWithdraw);
  }
  //let DavailableBalance = lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (amount) : -(amount);
  console.log("DavailableBalance------------------>>>>>", DavailableBalance);
  let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (amount) : -(amount);

  let Dcash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
  let Dcredit = lastMaxWithdraw?.credit || 0;
  let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;





  //if(bet.calculateExp==true){
  //if(cancelled!=1){
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
    creditRemaining: DcreditRemaining, marketId: bet.marketId,
    cashOrCredit: 'Bet',
    commissionFrom: commissionFrom,
    sportsId: bet.sportsId,
    shareNUpline: shareNUpline,
    upLineAmount: upLineAmount,
    betId: bet._id.toString(),
    matchId: bet.matchId,
    subMarketId: bet.subMarketId,
    marketId: bet.marketId,
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






  //for parents loop

  let winnerRunnerData = 0;
  let SessionScore = 0;

  const marketInfo = await MarketIDS.findOne({
    sportID: bet.sportsId,
    marketId: bet.marketId
  });
  winnerRunnerData = marketInfo?.winnerRunnerData;
  console.log("deleting marketId:", bet.marketId, "==bet.eventId:::", bet.eventId, "===bet.userId::", bet.userId);

  await Bets.updateMany(
    {
      //_id: bet._id,
      marketId: bet.marketId,
      //subMarketId:'7',
      eventId: bet.eventId,
      userId: bet.userId
    },
    {
      status: updatedBetStatus,
      position: winningAmount,
      iscalculatedExp: bet.exposureAmount,
      winnerRunnerData: winnerRunnerData,
      SessionScore: SessionScore,
      updatedAt: new Date().getTime()
    },
    { session }
  );



  await CurrentPosition2.deleteMany({
    userId: user.userId,

    marketId: bet.marketId


  }, { session });
  await RunnerWiselossShares.deleteMany({
    userId: user.userId,

    marketId: bet.marketId


  }, { session });
}

module.exports = {


  casinoSettlement,
  getAmountOfWinnerTemp,
  getAmountOfWinnerTempUpdated,
  getAmountOfWinnerFigures,
  returnParentExposure,
  SettleParents
}