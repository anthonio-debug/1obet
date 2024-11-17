const ExpPositive = require('../models/ExpPositive');
const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const Cash = require('../models/deposits');
const Bet = require('../models/bets')
const User = require('../models/user');
const Deposits = require('../models/deposits');
const cashValidator = require('../validators/deposits');
const loginRouter = express.Router();
const ExpRec = require('../models/ExpRec');


async function addCashDeposit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    const user_id = req.decoded.userId
    const user = await User.findOne({ userId: user_id })
    const clientPL= Math.abs(user.clientPL)
    if (clientPL > user.limitAmount && user.limitAmount>0) {
      return res.status(400).send({ message: `Cash deposit not allowed your clientPL limit has been exceeded.` });
    }
    if (req.body.amount < 1) {
      return res.status(400).send({ message: `Invalid Amount!` });
    }

    const userToUpdate = await User.findOne({
      userId: req.body.userId,
      isDeleted: false,
    });
    if (!userToUpdate) {
      return res.status(404).send({ message: 'user not found' });
    }
    const user_prev_balance = userToUpdate.balance;
    const user_prev_availableBalance = userToUpdate.availableBalance;
    const user_prev_exposure = userToUpdate.exposure;

    const currentUserParent = await User.findOne({
      userId: userToUpdate.createdBy,
      isDeleted: false,
    });
    if (!currentUserParent) {
      return res.status(404).send({ message: 'user not found' });
    }

    if (currentUserParent.role != '0') {
      if (
        req.body.amount >
        currentUserParent.cash + currentUserParent.creditRemaining
      ) {
        return res.status(400).send({
          message: `Max cash deposit is ${Math.floor(
            currentUserParent.cash + currentUserParent.creditRemaining
          )}`,
        });
      }
    }

    const cUserRes = await Cash.find({ userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);
    const lastMaxWithdraw = cUserRes.length > 0 ? cUserRes[0] : null;

    //console.log( ' ======================= lastMaxWithdraw =================================  ', lastMaxWithdraw );

    const parentRes = await Cash.find({ userId: currentUserParent.userId }).sort({ _id: -1 }).limit(1);
    const parentLastMaxWithdraw = parentRes.length > 0 ? parentRes[0] : null;

    //console.log(' ======================= parentLastMaxWithdraw =================================  ', parentLastMaxWithdraw);

    const Dealers = ['1', '2', '3', '4'];
    // company to Dealer  Deposit
    if (currentUserParent.role == '0' && userToUpdate.role != '5') {
      userToUpdate.clientPL += req.body.amount;
      userToUpdate.cash += req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance : 0,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash + req.body.amount
          : req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();
    }
    // company to Battor
    else if (currentUserParent.role == '0' && userToUpdate.role == '5') {
      userToUpdate.balance += req.body.amount;
      userToUpdate.availableBalance += req.body.amount;
      userToUpdate.clientPL += req.body.amount;
      userToUpdate.cash += req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw
          ? lastMaxWithdraw.balance + req.body.amount
          : req.body.amount,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance + req.body.amount
          : req.body.amount,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash + req.body.amount
          : req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();
    }

    // Dealer to Dealer
    else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      userToUpdate.clientPL += req.body.amount;
      userToUpdate.cash += req.body.amount;
      // currentUserParent.clientPL -= req.body.amount;
      currentUserParent.cash -= req.body.amount;

      // Add Cash
      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance : 0,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash + req.body.amount
          : req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();
      // -VS Cash from parent
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance : 0,
        availableBalance: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,
        credit: parentLastMaxWithdraw?.credit || 0,
        creditRemaining: parentLastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await parentCash.save();
    }

    // Dealer to Battor
    else if (Dealers.includes(currentUserParent.role) && userToUpdate.role == '5') {
      userToUpdate.balance += req.body.amount;
      userToUpdate.availableBalance += req.body.amount;
      userToUpdate.clientPL += req.body.amount;
      userToUpdate.cash += req.body.amount;
      // currentUserParent.clientPL -= req.body.amount;
      currentUserParent.cash -= req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw
          ? lastMaxWithdraw.balance + req.body.amount
          : req.body.amount,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance + req.body.amount
          : req.body.amount,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash + req.body.amount
          : req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();
      //console.log('cash', cash);

      // parent update
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance : 0,
        availableBalance: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,
        credit: parentLastMaxWithdraw?.credit || 0,
        creditRemaining: parentLastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await parentCash.save();
      //console.log('parentCash', parentCash);
    } else {
      return res.status(400).send({ message: 'Invalid Request' });
    }
    await userToUpdate.save();
    await currentUserParent.save();

    const updatedUser = await User.findOne({
      userId: req.body.userId,
      isDeleted: false,
    });
    const user_new_balance = updatedUser.balance;
    const user_new_availableBalance = updatedUser.availableBalance;
    const user_new_exposure = updatedUser.exposure;

    const updatedUserLastLedger = await Cash.find({
      userId: userToUpdate.userId,
    })
      .sort({ _id: -1 })
      .limit(1);


    return res.send({
      success: true,
      message: 'Cash deposit added successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(404).send({ message: 'server error', err });
  }
}


async function withDrawCashDeposit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    const user_id = req.decoded.userId
    const user = await User.findOne({ userId: user_id })
    const clientPL = Math.abs(user.clientPL);
    if (clientPL > user.limitAmount && user.limitAmount > 0) {
      return res.status(400).send({ message: `withdrawal not allowed your clientPL limit has been exceeded.` });
    }
    if (req.body.amount < 1) {
      return res.status(400).send({ message: `Invalid Amount!` });
    }
    const userToUpdate = await User.findOne({
      userId: req.body.userId,
      isDeleted: false,
    });
    // const firstParent = userToUpdate.createdBy
    const firstParent = await User.findOne({
      userId: userToUpdate.createdBy,
      isDeleted: false,
    });
     const firstParentCash = firstParent.cash
    const firstParentPL= Math.abs(firstParent.clientPL);
    if (firstParentPL > firstParent.limitAmount && firstParent.limitAmount>0) {
      return res.status(400).send({ message: `withdrawal not allowed your clientPL limit has been exceeded.` });
    }
    if (!userToUpdate) {
      return res.status(404).send({ message: 'user not found' });
    }


    if (userToUpdate.blockCashWithdraw == true) {
      return res.status(404).send({ message: 'Cash Withdraw Blocked' });
    }

    const user_prev_balance = userToUpdate.balance;
    const user_prev_availableBalance = userToUpdate.availableBalance;
    const user_prev_exposure = userToUpdate.exposure;
    const transData = await Deposits.find({ userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);
    //console.log(transData);
    const lastTrans = transData[0];
    //console.log(lastTrans);
    const currentUserParent = await User.findOne({
      userId: userToUpdate.createdBy,
      isDeleted: false,
    });
    if (!currentUserParent) {
      return res.status(404).send({ message: 'user not found' });
    }

    const checkAbs = Math.abs(userToUpdate.availableBalance - lastTrans.availableBalance)

    if (userToUpdate.role != '5' && req.body.amount > userToUpdate.cash + userToUpdate.creditRemaining) {
      //console.log('comming');
      return res.status(400).send({
        message: `Max cash withdraw is: ${userToUpdate.cash + userToUpdate.creditRemaining}`,
      });
    } else if (userToUpdate.role == '5' && req.body.amount > userToUpdate.availableBalance) {
      return res.status(400).send({
        message: `Max cash withdraw is= ${userToUpdate.availableBalance}`,
      });
    } else if (
      userToUpdate.role === '5' &&
      (req.body.amount > lastTrans.availableBalance || lastTrans.availableBalance < 0)
    ) {
      return res.status(400).send({
        message: `Something went wrong. Contact Support.`,
      });
      // } else if (userToUpdate.role === '5' && checkAbs >= 1) {
      //   return res.status(400).send({
      //     message: `Something went wrong. Contact Support.`,
      //   });
    }

    const cUserRes = await Cash.find({ userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);
    const lastMaxWithdraw = cUserRes.length > 0 ? cUserRes[0] : null;
    //console.log(' ======================= lastMaxWithdraw =================================  ', lastMaxWithdraw );
    const parentRes = await Cash.find({ userId: currentUserParent.userId })
      .sort({ _id: -1 })
      .limit(1);
    const parentLastMaxWithdraw = parentRes.length > 0 ? parentRes[0] : null;
    //console.log( ' ======================= parentLastMaxWithdraw =================================  ', parentLastMaxWithdraw );

    let Dealers = ['1', '2', '3', '4'];
    // Company to Dealer
    if (currentUserParent.role == '0' && userToUpdate.role != '5') {
      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance : 0,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,
        cashOrCredit: 'Cash',
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,
      });

      await cash.save();

    }

    // Company to Battor
    else if (currentUserParent.role == '0' && userToUpdate.role == '5') {
      userToUpdate.balance -= req.body.amount;
      userToUpdate.availableBalance -= req.body.amount;
      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw
          ? lastMaxWithdraw.balance - req.body.amount
          : -req.body.amount,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance - req.body.amount
          : -req.body.amount,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,

        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();

    }

    //  Dealer to Dealer
    else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      ``
      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;
      // currentUserParent.clientPL += req.body.amount;
      currentUserParent.cash += req.body.amount;

      // Add Cash
      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance : 0,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();

      // -VS Cash from parent
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance : 0,
        availableBalance: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        cash: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.cash + req.body.amount
          : req.body.amount,
        credit: parentLastMaxWithdraw?.credit || 0,
        creditRemaining: parentLastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await parentCash.save();

    }
    //  Dealer to Battor
    else if (Dealers.includes(currentUserParent.role) && userToUpdate.role == '5') {
      userToUpdate.balance -= req.body.amount;
      userToUpdate.availableBalance -= req.body.amount;
      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;
      currentUserParent.cash += req.body.amount;
      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw
          ? lastMaxWithdraw.balance - req.body.amount
          : -req.body.amount,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance - req.body.amount
          : -req.body.amount,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        //cash: userToUpdate.cash-req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();


      // parent update
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance : 0,
        availableBalance: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        // cash: parentLastMaxWithdraw
        //   ? parentLastMaxWithdraw.maxWithdraw + req.body.amount
        //   : req.body.amount,
        cash: firstParentCash + req.body.amount,
        credit: parentLastMaxWithdraw?.credit || 0,
        creditRemaining: parentLastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await parentCash.save().then(result => {
        console.log("MMMMMMMMMMMMMMMMMMMMMMMMMMM cash 6 ", result);

      }).catch(err => {
        console.log("EEEEEEEEEEEr cash 6 errror", err);

      });

    } else {
      return res.status(400).send({ message: 'Invalid Request' });
    }
    await userToUpdate.save();
    await currentUserParent.save();

    const updatedUser = await User.findOne({
      userId: req.body.userId,
      isDeleted: false,
    });
    const user_new_balance = updatedUser.balance;
    const user_new_availableBalance = updatedUser.availableBalance;
    const user_new_exposure = updatedUser.exposure;
    const updatedUserLastLedger = await Cash.find({
      userId: userToUpdate.userId,
    }).sort({ _id: -1 }).limit(1);
    const ExpTran = new ExpRec({
      userId: updatedUser.userId,
      trans_from: 'cashWithDraw',
      trans_from_id: updatedUserLastLedger._id,
      trans_bet_status: 0,
      user_prev_balance: user_prev_balance,
      user_prev_availableBalance: user_prev_availableBalance,
      user_prev_exposure: user_prev_exposure,
      user_new_balance: user_new_balance,
      user_new_availableBalance: user_new_availableBalance,
      user_new_exposure: user_new_exposure,
    });
    await ExpTran.save();

    return res.send({
      success: true,
      message: 'Cash withdrawl added successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(404).send({ message: 'server error', err });
  }
}
//to do need to add balance and availablebalance for cronjob winning bet




function getLedgerDetails(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }

    const query = { userId: req.body.userId };
    let page = 1;
    let sort = -1;
    let sortValue = '_id';
    let limit = config.pageSize;
    //console.log('limit:', limit);
    if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) limit = Number(req.body.numRecords);
    if (req.body.sortValue) sortValue = req.body.sortValue;
    if (req.body.sort) sort = Number(req.body.sort);
    if (req.body.page) page = Number(req.body.page);

    User.findOne(query, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }
      let cashPipeline = [{
        $match: {
          userId: Number(req.body.userId),
          $and: [
            {
              createdAt: { $gte: req.body.startDate }
            },
            {
              createdAt: { $lte: req.body.endDate }
            }
          ]
        }
      }];

      const userRole = user.role;

      const cashNCreditnBet = userRole === "5" ? ['Bet', 'Casino Bet', 'Cash', 'Credit'] : ['Bet', 'Casino Bet', "settledAmount"];


      if (userRole !== '5' && req.body.type) {
        cashPipeline.push({ $match: { cashOrCredit: req.body.type } });
      } else {
        cashPipeline.push({
          $match: { cashOrCredit: { $in: cashNCreditnBet } }
        });
      }

      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        cashPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$amount' },
                    regex: searchRegex,
                  },
                },
              },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$maxWithdraw' },
                    regex: searchRegex,
                  },
                },
              },
            ],
          },
        });
      }

      cashPipeline.push({
        $group: {
          _id: "$_id",
          // _id: {
          //   $cond: {
          //     if:
          //       { $in: ["$cashOrCredit", ['Cash', 'Credit', "settledAmount"]] },
          //     then: "$_id",
          //     else: {
          //       //matchId: "$matchId",
          //       marketId: "$marketId",
          //       betSession: "$betSession",
          //       roundId: "$roundId",
          //     }
          //   }
          // },
          originalId: { $first: "$_id" },
          description: { $first: "$description" },
          amount: { $first: "$amount" },
          balance: { $last: "$balance" },

          cash: { $last: "$cash" },
          credit: { $last: "$credit" },
          creditRemaining: { $last: "$creditRemaining" },

          availableBalance: { $last: "$availableBalance" },
          maxWithdraw: { $last: "$maxWithdraw" },
          betTime: { $first: "$betDateTime" },
          cashOrCredit: { $first: "$cashOrCredit" },
          date: { $first: "$date" },
          createdAt: { $first: "$createdAt" },
          sportsId: { $first: "$sportsId" },
          marketId: { $first: "$marketId" },
          roundId: { $first: "$roundId" },
          betId: { $first: "$betId" },
          userId: { $first: "$userId" },
          matchId: { $first: "$matchId" },
          userRole: { $first: userRole }
        },
      })

      cashPipeline.push(
        {
          $sort: { date: 1 },
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        }
      );

      Cash.aggregate(cashPipeline, async (err, result) => {
        if (result[0].results && result[0].results.length > 0) {
          for (let i = 0; i < result[0].results.length; i++) {
            if (result[0].results[i].betId) {
              try {
                const betInfo = await Bet.findOne({
                  _id: result[0].results[i].betId
                })
                result[0].results[i].betSession = betInfo?.betSession;
                result[0].results[i].matchType = betInfo?.matchType;
                result[0].results[i].matchId = betInfo?.matchId;
                result[0].results[i].SessionScore = betInfo?.SessionScore;
                result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
                result[0].results[i].fancyData = betInfo?.fancyData;
                result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
                result[0].results[i].roundId = betInfo?.roundId;
                result[0].results[i].subMarketId = betInfo?.subMarketId;
                result[0].results[i].role = userRole;
              } catch (err) {
                continue;
              }
            }
          }
        }

        if (err || !result || result.length === 0 || result[0].results.length === 0) {
          return res.status(200).send({ message: 'Deposit record not found' });
        }

        const responseData = {
          message: 'Deposit Records',

          results: {
            docs: result[0].results,
            total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
            limit: limit ? limit : 0,
            page: page ? page : 0,
            pages: limit && result[0].metadata[0].total ? Number((result[0].metadata[0].total / limit).toFixed(0)) : 0,
          },
        };

        return res.send(responseData);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" })
  }
}


function getLedgerDetails2(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }

    const query = { userId: req.body.userId };
    let page = 1;
    let sort = -1;
    let sortValue = '_id';
    let limit = config.pageSize;
    //console.log('limit:', limit);
    if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) limit = Number(req.body.numRecords);
    if (req.body.sortValue) sortValue = req.body.sortValue;
    if (req.body.sort) sort = Number(req.body.sort);
    if (req.body.page) page = Number(req.body.page);

    User.findOne(query, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }
      let cashPipeline = [{
        $match: {
          userId: Number(req.body.userId),
          $and: [
            {
              createdAt: { $gte: req.body.startDate }
            },
            {
              createdAt: { $lte: req.body.endDate }
            }
          ]
        }
      }];

      const userRole = user.role;

      if (userRole !== '5' && req.body.type) {
        cashPipeline.push({ $match: { cashOrCredit: req.body.type }, });
      }

      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        cashPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$amount' },
                    regex: searchRegex,
                  },
                },
              },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$maxWithdraw' },
                    regex: searchRegex,
                  },
                },
              },
            ],
          },
        });
      }

      cashPipeline.push({
        $group: {
          _id: "$_id",
          // _id: {
          //   $cond: {
          //     if: 
          //     { $in: ["$cashOrCredit", ['Cash', 'Credit']] }, 
          //     then: "$_id", 
          //     else: {
          //       matchId: "$matchId",
          //       marketId: "$marketId",
          //       betSession: "$betSession",
          //       roundId: "$roundId"
          //     }
          //   }
          // },
          originalId: { $first: "$_id" },
          description: { $first: "$description" },
          amount: { $sum: "$amount" },
          balance: { $last: "$balance" },
          availableBalance: { $last: "$availableBalance" },
          maxWithdraw: { $last: "$maxWithdraw" },
          betTime: { $first: "$betDateTime" },
          date: { $first: "$date" },
          createdAt: { $first: "$createdAt" },
          cashOrCredit: { $first: "$cashOrCredit" },
          sportsId: { $first: "$sportsId" },
          marketId: { $first: "$marketId" },
          betId: { $first: "$betId" },
          userId: { $first: "$userId" },
        },
      })

      cashPipeline.push(
        {
          $sort: { date: 1 },
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        }
      );

      //console.log('cashPipeline:', cashPipeline);

      Cash.aggregate(cashPipeline, async (err, result) => {

        if (result[0].results && result[0].results.length > 0) {
          for (let i = 0; i < result[0].results.length; i++) {
            if (result[0].results[i].betId) {
              try {
                const betInfo = await Bet.findOne({
                  _id: result[0].results[i].betId
                })

                result[0].results[i].betSession = betInfo?.betSession;
                result[0].results[i].matchType = betInfo?.matchType;
                result[0].results[i].SessionScore = betInfo?.SessionScore;
                result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
                result[0].results[i].fancyData = betInfo?.fancyData;
                result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
                result[0].results[i].roundId = betInfo?.roundId;
              } catch (err) {
                continue;
              }
            }
          }
        }
        if (
          err ||
          !result ||
          result.length === 0 ||
          result[0].results.length === 0
        ) {
          return res.status(200).send({ message: 'Deposit record not found' });
        }

        const responseData = {
          message: 'Deposit Records',

          results: {
            docs: result[0].results,
            total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
            limit: limit ? limit : 0,
            page: page ? page : 0,
            pages:
              limit && result[0].metadata[0].total
                ? Number((result[0].metadata[0].total / limit).toFixed(0))
                : 0,
          },
        };

        return res.send(responseData);
      });


    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" })
  }

}
// function getdeopsitDetailsCash(req, res) {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).send({ errors: errors.errors });
//     }

//     const query = { userId: req.decoded.userId };
//     let page = 1;
//     let sort = -1;
//     let sortValue = '_id';
//     let limit = config.pageSize;

//     if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) 
//       limit = Number(req.body.numRecords);

//     if (req.body.sortValue) 
//       sortValue = req.body.sortValue;

//     if (req.body.sort) 
//       sort = Number(req.body.sort);

//     if (req.body.page) 
//       page = Number(req.body.page);

//     User.findOne(query, (err, user) => {
//       if (err || !user) {
//         return res.status(404).send({ message: 'User not found' });
//       }
//       console.log(req.decoded)

//       let depositPipeline = [

//         {
//           $match: {
//             userId: Number(req.decoded.userId),
//             credit: 0, // Match deposits where cash field is zero
//             cash: { $gt: 0 },
//             cashOrCredit: "Cash",
//             $and: [
//               {
//                 createdAt: { $gte: req.body.startDate }
//               },
//               {
//                 createdAt: { $lte: req.body.endDate }
//               }
//             ]
//           }
//         },

//       ];
//       if (req.body.searchValue) {
//         const searchRegex = new RegExp(req.body.searchValue, 'i');
//         depositPipeline.push({
//           $match: {
//             $or: [
//               { description: { $regex: searchRegex } },
//               {
//                 $expr: {
//                   $regexMatch: {
//                     input: { $toString: '$amount' },
//                     regex: searchRegex,
//                   },
//                 },
//               },
//               {
//                 $expr: {
//                   $regexMatch: {
//                     input: { $toString: '$maxWithdraw' },
//                     regex: searchRegex,
//                   },
//                 },
//               },
//             ],
//           },
//         });
//       }
//       depositPipeline.push(
//         {
//           $group: {
//             _id: "$_id",
//             originalId: { $first: "$_id" },
//             description: { $first: "$description" },
//             amount: { $sum: "$amount" },
//             balance: { $last: "$balance" },
//             availableBalance: { $last: "$availableBalance" },
//             maxWithdraw: { $last: "$maxWithdraw" },
//             betTime: { $first: "$betDateTime" },
//             date: { $first: "$date" },
//             createdAt: { $first: "$createdAt" },
//             cashOrCredit: { $first: "$cashOrCredit" },
//             sportsId: { $first: "$sportsId" },
//             marketId: { $first: "$marketId" },
//             betId: { $first: "$betId" },
//             userId: { $first: "$userId" },
//             deposits:{$last: "$cash"}
//           },
//         },
//         {
//           $sort: { date: -1 },
//         },
//           {
//             $facet: {
//               metadata: [{ $count: 'total' }],
//               results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
//             },
//           }
//       )
//       Deposits.aggregate(depositPipeline, async (err, result) => {
//         console.log(result);
//         if (result[0].results && result[0].results.length > 0) {
//           for (let i = 0; i < result[0].results.length; i++) {
//             if (result[0].results[i].betId) {
//               try {
//                 const betInfo = await Bet.findOne({
//                   _id: result[0].results[i].betId
//                 })

//                 result[0].results[i].betSession = betInfo?.betSession;
//                 result[0].results[i].matchType = betInfo?.matchType;
//                 result[0].results[i].SessionScore = betInfo?.SessionScore;
//                 result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
//                 result[0].results[i].fancyData = betInfo?.fancyData;
//                 result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
//                 result[0].results[i].roundId = betInfo?.roundId;
//               } catch (err) {
//                 continue;
//               }
//             }
//           }
//         }
//         if (err || !result || result.length === 0 || result[0].results.length === 0) {
//           return res.status(200).send({ message: 'Deposit record not found' });
//         }

//         const responseData = {
//           message: 'Deposit Records',
//           results: {
//             docs: result[0].results,
//             total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
//             limit: limit ? limit : 0,
//             page: page ? page : 0,
//             pages: limit && result[0].metadata[0].total ? Number((result[0].metadata[0].total / limit).toFixed(0)) : 0,
//           },
//         };

//         return res.send(responseData);
//       });

//     });
//   } catch (err) {
//     res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" });
//   }

// }

function getdeopsitDetailsCash(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }

    const query = { userId: req.body.userId };
    let page = req.body.page ? Number(req.body.page) : 1;
    let sort = req.body.sort ? Number(req.body.sort) : -1;
    let sortValue = req.body.sortValue || '_id';
    let limit = req.body.numRecords && !isNaN(req.body.numRecords) && req.body.numRecords > 0
      ? Number(req.body.numRecords)
      : config.pageSize;

    let startDate = new Date(req.body.startDate);
    let endDate = new Date(req.body.endDate);

    if (startDate.toISOString().split('T')[0] === endDate.toISOString().split('T')[0]) {
      startDate.setDate(startDate.getDate() - 1);
    }
    console.log("there")
    startDate = startDate.toISOString().split('T')[0]
    endDate = endDate.toISOString().split('T')[0]


    console.log(startDate)
    console.log(endDate)
    User.findOne(query, (err, user) => {
      if (err || !user) return res.status(404).send({ message: 'User not found' });

      const userRole = user.role;
      let cashPipeline = [{
        $match: {
          userId: Number( req.body.userId),
          cashOrCredit: { $in: ["Cash", "settledAmount"] },
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      }];

      if (userRole !== '5' && req.body.type) {
        cashPipeline.push({ $match: { cashOrCredit: req.body.type } });
      }

      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        cashPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              { $expr: { $regexMatch: { input: { $toString: '$amount' }, regex: searchRegex } } },
              { $expr: { $regexMatch: { input: { $toString: '$maxWithdraw' }, regex: searchRegex } } },
            ]
          }
        });
      }

      cashPipeline.push({
        $group: {
          _id: "$_id",
          originalId: { $first: "$_id" },
          description: { $first: "$description" },
          amount: { $sum: "$amount" },
          balance: { $last: "$balance" },
          availableBalance: { $last: "$availableBalance" },
          cash: { $last: "$cash" },
          maxWithdraw: { $last: "$maxWithdraw" },
          betTime: { $first: "$betDateTime" },
          cashOrCredit: { $first: "$cashOrCredit" },
          date: { $first: "$date" },
          createdAt: { $first: "$createdAt" },
          sportsId: { $first: "$sportsId" },
          marketId: { $first: "$marketId" },
          roundId: { $first: "$roundId" },
          betId: { $first: "$betId" },
          userId: { $first: "$userId" },
          matchId: { $first: "$matchId" },
        }
      });

      cashPipeline.push(
        { $sort: { date: 1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            results: [{ $skip: (page - 1) * limit }, { $limit: limit }]
          }
        }
      );

      Cash.aggregate(cashPipeline, async (err, result) => {
        if (err || !result || result.length === 0 || result[0].results.length === 0) {
          return res.status(200).send({ message: 'Deposit record not found' });
        }

        if (result[0].results.length > 0) {
          for (let item of result[0].results) {
            if (item.betId) {
              try {
                const betInfo = await Bet.findOne({ _id: item.betId });
                if (betInfo) {
                  Object.assign(item, {
                    betSession: betInfo.betSession,
                    matchType: betInfo.matchType,
                    matchId: betInfo.matchId,
                    SessionScore: betInfo.SessionScore,
                    winnerRunnerData: betInfo.winnerRunnerData,
                    fancyData: betInfo.fancyData,
                    isfancyOrbookmaker: betInfo.isfancyOrbookmaker,
                    roundId: betInfo.roundId
                  });
                }
              } catch (err) {
                continue;
              }
            }
          }
        }

        const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;
        const responseData = {
          message: 'Deposit Records',
          results: {
            docs: result[0].results,
            total,
            limit,
            page,
            pages: Math.ceil(total / limit)
          }
        };

        return res.send(responseData);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" });
  }
}



function getdepositDetailsCredit(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }

    // const query = { userId: req.decoded.userId };
    const query = { userId: req.body.userId };
    let page = 1;
    let sort = -1;
    let sortValue = '_id';
    let limit = config.pageSize;

    if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) {
      limit = Number(req.body.numRecords);
    }
    if (req.body.sortValue) sortValue = req.body.sortValue;
    if (req.body.sort) sort = Number(req.body.sort);
    if (req.body.page) page = Number(req.body.page);

    User.findOne(query, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }

      let cashPipeline = [{
        $match: {
          userId: Number(req.body.userId),
          cashOrCredit: "Credit",
          $and: [
            {
              createdAt: { $gte: req.body.startDate }
            },
            {
              createdAt: { $lte: req.body.endDate }
            }
          ]
        }
      }];

      const userRole = user.role;

      if (userRole !== '5' && req.body.type) {
        cashPipeline.push({ $match: { cashOrCredit: req.body.type }, });
      }

      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        cashPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$amount' },
                    regex: searchRegex,
                  },
                },
              },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$maxWithdraw' },
                    regex: searchRegex,
                  },
                },
              },
            ],
          },
        });
      }

      cashPipeline.push({
        $group: {
          _id: {
            $cond: {
              if: { $in: ["$cashOrCredit", ['Credit','settledAmount']] },
              then: "$_id",
              else: {
                matchId: "$matchId",
                marketId: "$marketId",
                betSession: "$betSession",
                roundId: "$roundId"
              }
            }
          },
          originalId: { $first: "$_id" },
          description: { $first: "$description" },
          amount: { $sum: "$amount" },
          balance: { $last: "$balance" },
          credit: { $last: "$credit" },
          creditRemaining: { $last: "$creditRemaining" },
          availableBalance: { $last: "$availableBalance" },
          maxWithdraw: { $last: "$maxWithdraw" },
          betTime: { $first: "$betDateTime" },
          cashOrCredit: { $first: "$cashOrCredit" },
          date: { $first: "$date" },
          createdAt: { $first: "$createdAt" },
          sportsId: { $first: "$sportsId" },
          marketId: { $first: "$marketId" },
          roundId: { $first: "$roundId" },
          betId: { $first: "$betId" },
          userId: { $first: "$userId" },
          matchId: { $first: "$matchId" },
        },
      });

      cashPipeline.push(
        { $sort: { date: 1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        }
      );

      Cash.aggregate(cashPipeline, async (err, result) => {
        if (result[0].results && result[0].results.length > 0) {
          for (let i = 0; i < result[0].results.length; i++) {
            if (result[0].results[i].betId) {
              try {
                const betInfo = await Bet.findOne({ _id: result[0].results[i].betId });
                result[0].results[i].betSession = betInfo?.betSession;
                result[0].results[i].matchType = betInfo?.matchType;
                result[0].results[i].matchId = betInfo?.matchId;
                result[0].results[i].SessionScore = betInfo?.SessionScore;
                result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
                result[0].results[i].fancyData = betInfo?.fancyData;
                result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
                result[0].results[i].roundId = betInfo?.roundId;
              } catch (err) {
                continue;
              }
            }
          }
        }

        if (
          err ||
          !result ||
          result.length === 0 ||
          result[0].results.length === 0
        ) {
          console.log('Error:', err);
          console.log('Result:', result);
          console.log('Result length:', result ? result.length : 'result is null or undefined');
          console.log('First result\'s results length:', result && result[0] ? result[0].results.length : 'first result is null or undefined');
          return res.status(200).send({ message: 'Deposit record not found' });
        }

        const responseData = {
          message: 'Deposit Records',
          results: {
            docs: result[0].results,
            total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
            limit: limit ? limit : 0,
            page: page ? page : 0,
            pages: limit && result[0].metadata[0].total ? Math.ceil(result[0].metadata[0].total / limit) : 0,
          },
        };

        return res.send(responseData);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" });
  }
}

async function getAllDeposits(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }

  User.findOne({ userId: req.query.userId }, (err, user) => {
    if (err || !user)
      return res.status(404).send({ message: 'User not found' });
    User.findOne({ userId: user.createdBy }, (err, parentUser) => {
      if (err || !parentUser)
        return res.status(404).send({ message: 'User not found' });
      Cash.findOne(
        { userId: req.query.userId },
        // creditlimit should be of the parent user
        { maxWithdraw: 1 }
      )
        .sort({ _id: -1 })
        .exec(async (err, results) => {
          // const resp = await userWithdrawStatusCheck(Number(req.query.userId))
          if (err) {
            //console.log('Error'.err);
            return res.status(404).send({ message: 'Record not found' });
          }
          if (!results) {
            return res.status(200).send({
              message: 'Record not found',
              // status: resp,
              results: {
                maxWithdraw: 0,
                creditLimit: 0,
                balance: 0,
                credit: 0,
                availableBalance: 0,
              },
            });
          }



          if (user.role == '5') {
            return res.send({
              message: 'Deposit Record Found',
              // status: resp,
              results: {
                maxWithdraw: user.availableBalance,
                creditLimit: parentUser.creditRemaining,
                balance: user.balance,
                credit: user.credit,
                availableBalance: user.availableBalance,
              },
            });
          } else {
            return res.send({
              message: 'Deposit Record Found',
              // status: resp,
              results: {
                ...results._doc,
                creditLimit: parentUser.creditRemaining,
                balance: user.balance,
                credit: user.credit,
                availableBalance: user.availableBalance,
              },
            });
          }
        });
    });
  });
}

async function getPositiveRecords(req, res) {
  const { userId } = req.body;
  try {
    const expPositives = await ExpPositive.aggregate([
      {
        $match: {
          $expr: {
            $or: [
              { $eq: ["$userId", userId] },
              { $eq: [userId, null] }
            ]
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "userId",
          as: "userData"
        }
      },
      {
        $project: {
          betId: 1,
          source: 1,
          roundId: 1,
          createdAt: 1,
          _id: 1,
          expReleased: 1,
          prevExposure: 1,
          __v: 1,
          expCaptured: 1,
          AbAtRelease: 1,
          finalShareAmountInLossPrev: 1,
          prevAdjustedExposure: 1,
          expAfterRelease:1,
          exposureAmount: 1,
          updatedAt: 1,
          userId: { $arrayElemAt: ["$userData.userId", 0] },
          UserName: { $arrayElemAt: ["$userData.userName", 0] },
          downLineShare: { $arrayElemAt: ["$userData.downLineShare", 0] }
        }
      }
    ])

    return res.status(200).json({
      success: true,
      message: "Fetched records successfully",
      data: expPositives,
    });
  } catch (error) {
    console.error("Error fetching expPositives:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching records",
    });
  }
};

// const userWithdrawStatusCheck = async (userId) => {
//   const resp = {
//     status: 200,
//     englush: "Take screenshot and contact support team",
//     urdu: "اسکرین شاٹ لیں اور سپورٹ ٹیم سے رابطہ کریں۔"
//   }
//   // const userId = Number(req.query.id);
//   const user   = await  User.findOne({ userId: userId })
//   const deposit = await Cash.find({ userId: userId }).sort({ _id: -1 }).limit(1);
//   const lastDeposit = deposit[0]
//   const activeBetsCount = await Bet.countDocuments({ userId: userId, status: 1 });
//   const difference = lastDeposit.availableBalance - user.availableBalance - (-user.exposure)
//   if(user.exposure > 1 ){
//     resp.status = 400;
//   }else if(user.exposure < -1 && activeBetsCount === 0){
//     resp.status = 400;
//   }else if(user.exposure < -1 && activeBetsCount > 0 &&   ( difference < -1 || difference > 1 )){
//     resp.status = 400;
//   }
//   return resp
// }

loginRouter.post("/positive-exposure", getPositiveRecords)

loginRouter.post(
  '/addCashDeposit',
  cashValidator.validate('addCashDeposit'),
  addCashDeposit
);
loginRouter.post(
  '/withDrawCashDeposit',
  cashValidator.validate('withDrawCashDeposit'),
  withDrawCashDeposit
);
loginRouter.post('/getLedgerDetails', getLedgerDetails);
loginRouter.post('/getLedgerDetails2', getLedgerDetails2);
loginRouter.post('/getdeopsitDetailsCash', getdeopsitDetailsCash);
loginRouter.post('/getdeopsitDetailsCredit', getdepositDetailsCredit);
loginRouter.get('/getAllDeposits', getAllDeposits);
module.exports = { loginRouter, getdeopsitDetailsCash, getdepositDetailsCredit };