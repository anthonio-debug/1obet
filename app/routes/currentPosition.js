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
                  "Soccer": [
                      {
                          "match": "Accrington v Peterborough / Match Odds",
                          "amount": 0
                      },
                      {
                          "match": "Alanyaspor v Galatasaray / Match Odds",
                          "amount": 120274
                      },
                      {
                          "match": "Blackpool v West Brom / Match Odds",
                          "amount": 0
                      },
                      {
                          "match": "Bragantino SP v Oriente Petrolero / Match Odds",
                          "amount": 0
                      }
                  ],
                  "Tennis": [
                      {
                          "match": "Albot v Coria / Match Odds",
                          "amount": 50477
                      },
                      {
                          "match": "Arnaldi v Munar / Match Odds",
                          "amount": 403841
                      }
                  ],
                  "Basketball": [
                      {
                          "match": "Lakers vs Celtics",
                          "amount": 5
                      },
                      {
                          "match": "Warriors vs Rockets",
                          "amount": 2
                      }
                  ],
                  "Cricket": [
                      {
                          "match": "Chennai Super Kings v Sunrisers Hyderabad / Match Odds",
                          "amount": 0
                      },
                      {
                          "match": "Delhi Capitals v Kolkata Knight Riders / Match Odds",
                          "amount": 0
                      }
                  ],
                  "Football": [
                      {
                          "match": "Manchester United vs Liverpool",
                          "amount": 4
                      },
                      {
                          "match": "Real Madrid vs Barcelona",
                          "amount": 3
                      },
                      {
                          "match": "Manchester United vs Liverpool",
                          "amount": 4
                      },
                      {
                          "match": "Real Madrid vs Barcelona",
                          "amount": 3
                      }
                  ]
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
