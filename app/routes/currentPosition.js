const express = require('express');
const User = require('../models/user');
const Deposits = require('../models/deposits');
const MarketType = require('../models/marketTypes');
const Bets = require('../models/bets');
const loginRouter = express.Router();

function getCurrentPosition(req, res) {

    // User.find({createdBy:String(req.decoded.userId)},(err,users) => {
    //   if(err||!users) return res.send({ message:'user not found' })
    // const createdByIDs = users.map(userId==users.userId)
    // })
    const userId = req.query.userId;
    const marketId = req.query.marketId;
    Deposits.find({ userId: userId, marketId: marketId, }, { _id: 0, amount: 1, createdAt:1 })
      .exec()
      .then((deposits) => {
        if (!deposits || deposits.length === 0) {
          return res.status(404).send({ message: 'No deposit records found' });
        }
  
        Bets.find({ userId: userId, marketId: marketId }, { _id: 0, event: 1, createdAt: 1 })
          .exec()
          .then((bets) => {
            if (!bets || bets.length === 0) {
              return res.status(404).send({ message: 'No bet records found' });
            }
  
            const totalAmount = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);
  
            const response = {
              success: true,
              message: 'current position found',
              results: [{
                Date: deposits[0].createdAt,
                Event: bets[0].event,
                Amount: totalAmount,
              }],
            };
  
            return res.send(response);
          })
          .catch((err) => {
            return res.status(404).send({ message: 'Error retrieving bet records' });
          });
      })
      .catch((err) => {
        return res.status(404).send({ message: 'Error retrieving deposit records' });
      });
  }

loginRouter.get('/getCurrentPosition', getCurrentPosition);

module.exports = { loginRouter };
