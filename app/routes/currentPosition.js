const express         = require('express');
const User            = require('../models/user');
const Deposits        = require('../models/deposits');
const MarketType      = require('../models/marketTypes');
const Bets            = require('../models/bets');
const currentPosition = require('../models/CurrentPosition');
const loginRouter     = express.Router();

function getCurrentPosition(req, res) {
  try{
    const userId = req.decoded.userId;
    
    
    currentPosition.aggregate([
      // {
      //   $match: {
      //     userId: userId
      //   }
      // },
      // {
      //   "$lookup": {
      //     "from": "inplayevents",
      //     "localField": "matchId",
      //     "foreignField": "Id",
      //     "as": "matchs"
      //   }
      // },
      // {
      //   "$unwind": "$matchs"
      // },
      // {
      //   $group: {
      //     _id: "$matchs.Id",
      //     "name": {
      //       "$first": "$match.name"
      //     },
      //     amount: {
      //       $sum: "$amount"
      //     }
      //   }
      // }
    ], (err, currentPositionData)=>{
      if(err){
        return {
          success: false,
          message: 'Failed to get data',
          error: err,
      }; 
      }
      const response = {
        success: true,
        message: 'current position records',
        results: [currentPositionData]
      };
      res.send(response)

    });
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

// Define the API endpoint
function getCurrentPosition_old(req, res) {
  // const userId = req.decoded.userId,
  // currentPosition.find({userId: userId})
  //     .exec()
  //     .then((bets) => {

  //       if (!bets || bets.length === 0) {
  //         return res.status(404).send({ message: 'No bet records found' });
  //       }
  
  //       const formattedData = {};
  
  //       for (const bet of bets) {
  //         const { sport, event, loosingAmount } = bet;
  // console.log('bet.sport',bet.sport);
  //         if (!formattedData[sport]) {
  //           formattedData[sport] = [];
  //         }
  
  //         formattedData[sport].push({
  //           match: event,
  //           amount: loosingAmount
  //         });
  //       }
  
  //       const response = {
  //         success: true,
  //         message: 'current position found',
  //         results: [formattedData]
  //       };
  
  //       return res.send(response);
  //     })
  //     .catch((err) => {
  //       return res.status(404).send({ message: 'Error retrieving bet records' });
  //     });
}
  


// let prev = 0;
// parentUser.forEach(user => {
//   let current = user.downLineShare;
//   user["commission"] = current - prev;
//   prev = current;
// });

// for (const user of parentUser) {
//   let CurrentPosition = await new CurrentPosition({
//     userId: user.userId,
//     description: "some transection name",
//     amount: -(user.commission / 100) * remainingAmount,
//     betId: bet._id,
//     matchId: matchId,
//   });
//   await CurrentPosition.save();
// }

  

loginRouter.get('/getCurrentPosition', getCurrentPosition);

module.exports = { loginRouter };
