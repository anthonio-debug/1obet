const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');
const cricketMatch = require('../models/cricketMatches');

const reportValidator = require('../validators/reports');
const Deposits = require('../models/deposits');
const MarketType = require('../models/marketTypes');
const Bets = require('../models/bets');
const loginRouter = express.Router();

async function getAllChildrens(createdByIDs) {
  const userIDs = [];
  const queriedUserIDs = new Set(); // Keep track of queried user IDs

  if (createdByIDs.length === 0) {
    return userIDs;
  }

  const uniqueIDs = Array.from(new Set(createdByIDs)); // Remove duplicate IDs

  const users = await User.find(
    { createdBy: { $in: uniqueIDs } },
    { userId: 1, userName: 1, createdBy: 1 }
  ).lean();

  for (const user of users) {
    if (!queriedUserIDs.has(user.userId)) {
      userIDs.push(user.userId);
      queriedUserIDs.add(user.userId);
    }
  }

  const subUserIDs = await getAllChildrens(userIDs);
  userIDs.push(...subUserIDs);
  return Array.from(new Set(userIDs)); // Ensure unique user IDs in the final array
}

async function getDailyReport(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  let query = {};
  let depositsQuery = {};
  depositsQuery.cashOrCredit =  { $in: ["Bet", "Commission"] }
  let userId = String(req.decoded.userId);

  if (req.decoded.role !== '5') {
    query.createdBy = userId;
  }

  try {
    const users = await User.find(query, { userId: 1, userName: 1, createdBy: 1 }).lean();
    
    if (!users || users.length === 0) {
      return res.status(404).send({ message: 'No users found' });
    }

    let createdByIDs = users.map((user) => user.userId);

    const allUserIDs = await getAllChildrens(createdByIDs);
    const combinedArray = [...allUserIDs, ...createdByIDs, userId];

    const deposits = await Deposits.find({ userId: { $in: combinedArray }, ...depositsQuery }).exec();

    if (!deposits || deposits.length === 0) {
      return res.status(404).send({ message: 'No records found' });
    }

    const userIds = [...new Set(deposits.map((deposit) => deposit.userId))];
    const usersData = await User.find({ userId: { $in: userIds } }, 'userId userName').lean();

    const depositMap = {};
    usersData.forEach((user) => {
      depositMap[user.userId] = user.userName;
    });

    const results = deposits.reduce((acc, deposit) => {
      const existingUser = acc.find((user) => user.userId === deposit.userId);
      if (existingUser) {
        existingUser.amount += deposit.amount;
      } else {
        acc.push({
          userId: deposit.userId,
          userName: depositMap[deposit.userId],
          amount: deposit.amount,
        });
      }
      return acc;
    }, []);

    return res.send({
      success: true,
      message: 'daily pl records found',
      results: results,
    });
  } catch (err) {
    return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
  }
}

function dailySportsWiseReport(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  let depositsQuery = {};
  depositsQuery.cashOrCredit =  { $in: ["Bet", "Commission"] }
  if (req.query.endDate && req.query.startDate) {
    depositsQuery.createdAt = {
      $gte: req.query.startDate,
      $lte: req.query.endDate,
    };
  }


  User.find({userId: req.query.userId})
    .then((users) => {
      if (!users || users.length === 0) {
        return res.status(404).send({ message: 'No users found' });
      }
      const userIds = users.map((user) => user.userId);


      Deposits.find({ userId: { $in: userIds },  ...depositsQuery })
        .exec()
        .then((deposits) => {
          if (!deposits || deposits.length === 0) {
            return res.status(404).send({ message: 'No records found' });
          }

          const marketIds = deposits.map((deposit) => deposit.marketId);

          MarketType.find({ marketId: { $in: marketIds } }, 'marketId name')
            .then((markets) => {
              const marketMap = {};
              markets.forEach((market) => {
                marketMap[market.marketId] = market.name;
              });

              const results = deposits.reduce((acc, deposit) => {
                const existingMarket = acc.find((item) => item.name === marketMap[deposit.marketId]);
                if (existingMarket) {
                  existingMarket.amount += deposit.amount;
                } else {
                  acc.push({
                    name: marketMap[deposit.marketId],
                    amount: deposit.amount,
                  });
                }
                return acc;
              }, []);

              return res.send({
                success: true,
                message: 'daily sportswise pl records found',
                results: results,
              });
            })
            .catch((err) => {
              return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
            });
        })
        .catch((err) => {
          return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
        });
    })
    .catch((err) => {
      return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
    });
}

function dailyMarketsReports(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  let depositsQuery = {};
  depositsQuery.cashOrCredit = { $in: ["Bet", "Commission"] };
  if (req.query.endDate && req.query.startDate) {
    depositsQuery.createdAt = {
      $gte: req.query.startDate,
      $lte: req.query.endDate,
    };
  }

  const userId = req.query.userId;
  const marketId = req.query.marketId;
  Deposits.find({ userId: userId, marketId: marketId, ...depositsQuery }, { _id: 0, amount: 1, createdAt: 1, betId: 1 })
    .exec()
    .then((deposits) => {
      if (!deposits || deposits.length === 0) {
        return res.status(404).send({ message: 'No deposit records found' });
      }
      const betIds = deposits.map((deposit) => deposit.betId);

      Bets.find({ _id: { $in: betIds }, marketId: marketId }, { _id: 1, event: 1, createdAt: 1, matchId: 1 })
        .exec()
        .then((bets) => {
          if (!bets || bets.length === 0) {
            return res.status(404).send({ message: 'No bet records found' });
          }
          const matchIds = bets.map((bet) => bet.matchId);
          cricketMatch
            .find({ id: { $in: matchIds } }, { id: 1, name: 1 })
            .exec()
            .then((matches) => {
              if (!matches || matches.length === 0) {
                return res.status(404).send({ message: 'No match records found' });
              }
              const matchAmounts = {};
              // Calculate total amount per match by grouping deposits
              deposits.forEach((deposit) => {
                const bet = bets.find((bet) => bet._id == deposit.betId);
                console.log('bet', bet);
                if (bet) {
                  const match = matches.find(
                    (match) => match.id == bet.matchId
                  );
                  console.log('match', match);
                  if (match) {
                    if (!matchAmounts[match.id]) {
                      matchAmounts[match.id] = {
                        matchName: match.name,
                        amount: deposit.amount,
                      };
                    } else {
                      matchAmounts[match.id].amount += deposit.amount;
                    }
                  }
                }
              });

              // Sum up the amounts for bets on the same match
              const results = Object.values(matchAmounts).map(
                (matchAmount) => ({
                  Date: deposits[0].createdAt,
                  Event: matchAmount.matchName,
                  Amount: matchAmount.amount,
                })
              );
              console.log('results', results);
              const response = {
                success: true,
                message: 'Daily Markets Reports found',
                results: results,
              };

              return res.send(response);
            })
            .catch((err) => {
              console.log('Error retrieving match records:', err);
              return res.status(404).send({ message: 'Error retrieving match records' });
            });
        })
        .catch((err) => {
          console.log('Error retrieving bet records:', err);
          return res.status(404).send({ message: 'Error retrieving bet records' });
        });
    })
    .catch((err) => {
      console.log('Error retrieving deposit records:', err);
      return res.status(404).send({ message: 'Error retrieving deposit records' });
    });
}

loginRouter.get('/getDailyReport',reportValidator.validate('getDailyPLReport'), getDailyReport);
loginRouter.get('/dailySportsWiseReport',reportValidator.validate('dailyPLSportsWiseReport'), dailySportsWiseReport);
loginRouter.get('/dailyMarketsReports',reportValidator.validate('dailyPlMarketsReports'), dailyMarketsReports);

module.exports = { loginRouter };
