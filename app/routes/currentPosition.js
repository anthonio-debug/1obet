const express = require('express');
const router = express.Router();
const currentPosition = require('../models/CurrentPosition');
const expPositive = require("../models/ExpPositive");
const { SettleParents } = require('../../resultSystem/src/CalculateBets/helper');
const Bets = require('../models/bets');
const getParents = require('../../app/routes/bets');
const User = require('../models/user');
const Deposits = require('../models/deposits');
const MarketId = require("./../models/marketIds")
const CurrentPosition2 = require('./../models/CurrentPosition2.js');
const RunnerWiselossShares = require('./../models/RunnerWiselossShares');
const loginRouter = express.Router();


function getCurrentPosition(req, res) {
  try {
    const userId = req.decoded.userId;
    //console.log("userId ======= ", userId);
    currentPosition.aggregate([
      {
        $match: {
          userId: userId
        }
      },
      {
        $addFields: {
          'inPlayEventId': { $toObjectId: "$matchsId" }
        }
      },
      {
        "$lookup": {
          "from": "inplayevents",
          "localField": "inPlayEventId",
          "foreignField": "_id",
          "as": "matches"
        }
      },
      {
        "$unwind": "$matches"
      },
      {
        $group: {
          _id: "$matches._id",
          "name": {
            "$first": "$matches.name"
          },
          "sportsId": {
            "$first": "$matches.sportsId"
          },
          "Id": {
            "$first": "$matches.Id"
          },
          "marketId": {
            "$first": "$matches.marketIds"
          },
          amount: {
            $sum: "$amount"
          }
        }
      }
    ], (err, currentPositionData) => {
      if (err) {
        const response = {
          success: false,
          message: 'Failed to get data',
          error: err,
        };
        res.send(response);
      } else {
        const response = {
          success: true,
          message: 'current position records',
          results: currentPositionData
        };
        res.send(response);
      }
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



const currentPositionDetails = async (req, res) => {
  try {
    const userId = req.decoded.userId;
    const matchId = req.query.matchId;

    currentPosition.aggregate([
      {
        $match: {
          userId: userId,
          matchsId: matchId
        }
      },
      {
        $addFields: {
          'betsId': { $toObjectId: "$betId" }
        }
      },
      {
        "$lookup": {
          "from": "bets",
          "localField": "betsId",
          "foreignField": "_id",
          "as": "bets"
        }
      },
      {
        $group: {
          _id: "$_id",
          marketId: { $first: { $arrayElemAt: ["$bets.marketId", 0] } },
          matchId: { $first: { $arrayElemAt: ["$bets.matchId", 0] } },
          loosingAmount: { $first: "$amount" },
          loosingAmount1: { $first: { $arrayElemAt: ["$bets.loosingAmount", 0] } },
          winningAmount1: { $first: { $arrayElemAt: ["$bets.winningAmount", 0] } },
          maxWinningAmount: {
            $first: {
              $multiply: [
                { $arrayElemAt: ["$bets.loosingAmount", 0] },
                { $divide: ["$share", 100] }
              ]
            }
          },
          runner: { $first: { $arrayElemAt: ["$bets.runner", 0] } },
          TargetScore: { $first: { $arrayElemAt: ["$bets.TargetScore", 0] } },
          betRate: { $first: { $arrayElemAt: ["$bets.betRate", 0] } },
          betSession: { $first: { $arrayElemAt: ["$bets.betSession", 0] } },
          resultId: { $first: { $arrayElemAt: ["$bets.resultId", 0] } },
          fancyData: { $first: { $arrayElemAt: ["$bets.fancyData", 0] } },
          isfancyOrbookmaker: { $first: { $arrayElemAt: ["$bets.isfancyOrbookmaker", 0] } },
          subMarketId: { $first: { $arrayElemAt: ["$bets.subMarketId", 0] } },
          fancyRate: { $first: { $arrayElemAt: ["$bets.fancyRate", 0] } },
          runnerId: { $first: { $arrayElemAt: ["$bets.runnerName", 0] } },
          type: { $first: { $arrayElemAt: ["$bets.type", 0] } },
          share: { $first: "$share" }
        }
      }
    ], (err, currentPositionData) => {
      if (err) {
        const response = {
          success: false,
          message: 'Failed to get data',
          error: err,
        };
        res.send(response);
      } else {
        const response = {
          success: true,
          message: 'current position records',
          results: currentPositionData
        };
        res.send(response);
      }
    });
  } catch (err) {
    // //console.log("current positiion Error ============= ", err);
    const response = {
      success: true,
      message: `current position error ${err}`,
    }
    res.send(response);
  }
}
const currentPositionDetails3 = async (req, res) => {
  
  try {
    // Connect to MongoDB
    const {userId,eventId} = req.body
    //const userId = req.decoded.userId;
    //const betSession = req.query.betSession;
    //const eventId = req.query.eventId;
    //const marketId = req.query.marketId;
    //const subMarketId = req.query.subMarketId;
    
    // Fetch data from the collection
//     const results = 
// await CurrentPosition2.find({
//   userId:45860,
//   //betSession:betSession,
//   eventId:'33898862'
//   //marketId:marketId,
//   //subMarketId:subMarketId
// });

// let formattedResponse;

// // Format the response
// try {
//   formattedResponse = results.map(result => {
//     return {
//       marketId: result.marketId,
//       //subMarketId: result.subMarketId,
//       eventId: result.eventId,
//       //event: result.event,
//       //betSession: result.betSession,
//       //marketName: result.marketName,
//       runnersPosition: result.runnersPosition.map(runner => ({
//         Amount: runner.amount,
//         runner: runner.runner,
//         //runnerName: runner.runner,
//         //maxWinningAmount: runner.amount,
//         //loosingAmount: runner.amount,
//       }))
//     };
//   });
// } catch (err) {
//   console.error(err);
//   return res.json({
//     success: false,
//     message: 'Here is the error that your data is not being fetched....................'
//   });
// }

// // Return the formattedResponse as an array
// res.status(200).json({ results: formattedResponse });
const results = await CurrentPosition2.find({
  userId: userId,
  eventId: eventId
});

let formattedResponse;

try {
  formattedResponse = results.map(result => {
    return {
      marketId: result.marketId,
      eventId: result.eventId,
      betSession: result.betSession,
      // Other properties you want to include can go here
      runnersPosition: result.runnersPosition.map(runners => {
        // Use Object.values() to convert the object into an array and then map over it
        return Object.values(runners).map(runner => ({
          Amount: runner.amount,
          runner: runner.runner,
        }));
      }).flat() // Use .flat() to flatten the resulting array
    };
  });
} catch (err) {
  console.error(err);
  return res.json({
    success: false,
    message: 'Here is the error that your data is not being fetched...'
  });
}

// Return the formattedResponse as an array
res.status(200).json({ results: formattedResponse });

} catch (error) {
    console.error("Error fetching data:", error);
    throw error;
} finally {
    
}
};
const getCurrentPosition3 = async (req, res) => {
  try {
    const userId = req.decoded.userId;
    const matchId = req.query.matchId;
    const marketId = req.query.marketId;
    const subMarketId = req.query.subMarketId;
    
    const currentPositionData2 = await CurrentPosition2.find({
      //marketId: marketId,
      //matchsId: matchId,
      userId: userId,
      //subMarketId: subMarketId
    })
   
    const response = {
      success: true,
      message: 'current position records',
      results: currentPositionData2
    };
    res.send(response);

  } catch (err) {
    // console.log("current positiion Error ============= ", err);
    const response = {
      success: true,
      message: `current position error ${err}`,
    }
    res.send(response);
  }
}

const getCurrentPosition2 = async (req, res) => {
  try {
    const userId = req.decoded.userId;
    const matchId = req.query.matchId;

    // const marketId = req.query.marketId;
    // const subMarketId = req.query.subMarketId;
    
    const currentPositionData2 = await CurrentPosition2.find({ userId: userId })
   
    currentPosition.aggregate([
      {
        $match: {
          userId: userId
        }
      },
      {
        $addFields: {
          'betsId': { $toObjectId: "$betId" }
        }
      },
      {
        "$lookup": {
          "from": "bets",
          "localField": "betsId",
          "foreignField": "_id",
          "as": "bets"
        }
      },
      {
        $addFields: {
          'inPlayEventId': { $toObjectId: "$matchsId" }
        }
      },
      {
        "$lookup": {
          "from": "inplayevents",
          "localField": "inPlayEventId",
          "foreignField": "_id",
          "as": "matches"
        }
      },
      {
        $group: {
          _id: "$_id",
          marketId: { $first: { $arrayElemAt: ["$bets.marketId", 0] } },
          matchId: { $first: { $arrayElemAt: ["$bets.matchId", 0] } },
          loosingAmount: { $first: "$amount" },
          maxWinningAmount: {
            $first: {
              $multiply: [
                { $arrayElemAt: ["$bets.loosingAmount", 0] },
                { $divide: ["$share", 100] }
              ]
            }
          },
          runner: { $first: { $arrayElemAt: ["$bets.runner", 0] } },
          createdAt: { $first: { $arrayElemAt: ["$bets.createdAt", 0] } },
          userId: { $first: { $arrayElemAt: ["$bets.userId", 0] } },
          TargetScore: { $first: { $arrayElemAt: ["$bets.TargetScore", 0] } },
          betRate: { $first: { $arrayElemAt: ["$bets.betRate", 0] } },
          betSession: { $first: { $arrayElemAt: ["$bets.betSession", 0] } },
          resultId: { $first: { $arrayElemAt: ["$bets.resultId", 0] } },
          fancyData: { $first: { $arrayElemAt: ["$bets.fancyData", 0] } },
          isfancyOrbookmaker: { $first: { $arrayElemAt: ["$bets.isfancyOrbookmaker", 0] } },
          subMarketId: { $first: { $arrayElemAt: ["$bets.subMarketId", 0] } },
          fancyRate: { $first: { $arrayElemAt: ["$bets.fancyRate", 0] } },
          runnerId: { $first: { $arrayElemAt: ["$bets.runnerName", 0] } },
          runners: { $first: { $arrayElemAt: ["$bets.runnersPosition", 0] } },
          type: { $first: { $arrayElemAt: ["$bets.type", 0] } },
          sportsId: { $first: { $arrayElemAt: ["$bets.sportsId", 0] } },
          event: { $first: { $arrayElemAt: ["$bets.event", 0] } },
          mId: { $first: { $arrayElemAt: ["$matches.Id", 0] } },
          matchId: { $first: { $arrayElemAt: ["$matches._id", 0] } },
          share: { $first: "$share" }
        }
      },
      {
        $sort: { _id: -1 }
      },
    ], (err, currentPositionData) => {
      // console.log("MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM currentPositionData",currentPositionData);
      
      if (err) {
        const response = {
          success: false,
          message: 'Failed to get data',
          error: err,
        };
        res.send(response);
      } else {
        for (const [index, item] of currentPositionData.entries()) {
          for (const data2 of currentPositionData2) {
            if (data2?.matchsId === item.matchId && data2?.marketId === item.marketId && data2?.subMarketId === item.subMarketId) {
              currentPositionData[index].position2Amount = data2.amount
              continue
            }
          }
        }
        const response = {
          success: true,
          message: 'current position records-----'+currentPositionData2,
          results: currentPositionData
        };
        res.send(response);
      }
    });
  } catch (err) {
    // console.log("current positiion Error ============= ", err);
    const response = {
      success: true,
      message: `current position error ${err}`,
    }
    res.send(response);
  }
}

const getHighlights = async (req, res) => {
  try {
    const userId = req.decoded.userId;
    const matchId = req.query.matchId;

    const currentPositionData = await MarketId.aggregate([
      {
        $match: {
          status: { $not: /CLOSED/i },
          marketName: "Match Odds",
        },
      },
      {
        $lookup: {
          from: "inplayevents",
          let: { eventId: "$eventId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$Id", "$$eventId"] },
                    { $eq: ["$CompanySetStatus", "OPEN"] },
                    { $eq: ["$isShowed", true] },
                    { $eq: ["$status", "OPEN"] },
                  ],
                },
              },
            },
            {
              $project: {
                name: 1,
                openDate: 1,
                CompanySetStatus: 1,
                isShowed: 1,
                inPlay:1

              },
            },
          ],
          as: "inplayData",
        },
      },
      {
        $lookup: {
          from: "odds",
          let: { eventId: "$eventId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$eventId", "$$eventId"] },
              },
            },
            {
              $project: {
                totalMatched: 1
                
              },
            },
          ],
          as: "oddsData",
        },
      },
      {
        $addFields: {
          inplayData: { $arrayElemAt: ["$inplayData", 0] },
          oddsData: { $arrayElemAt: ["$oddsData", 0] },
        },
      },
      {
        $project: {
          eventName: "$inplayData.name",
          openDate: "$inplayData.openDate",
          CompanySetStatus: "$inplayData.CompanySetStatus",
          isShowed: "$inplayData.isShowed",
          totalMatched: "$oddsData.totalMatched",
          inplay: "$oddsData.isInplay",
          marketName: 1,
          eventId: 1,
          sportID: 1,
          marketStatus: "$status",
          marketInplay: "$inPlay",
        },
      },
      {
        $addFields: {
          openDate: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: { $toDate: "$openDate" },
              timezone: "UTC",
            },
          },
        },
      },
      {
        $sort: {
          openDate: -1,
        },
      },
    ]);

    res.send({ success: true, message: "highlights records", results: currentPositionData });

  } catch (err) {
    console.error("Error in getHighlights: ", err);
    res.status(500).send({
      success: false,
      message: `Error: ${err.message}`,
    });
  }
};


const battorcurrentPosition = async (req, res) => {
  try {
    const userId = req.decoded.userId;
    Bets.aggregate([
      {
        $match: {
          userId: userId,
          status: 1,
          calculateExp: true
        }
      },
      {
        $addFields: {
          'inPlayEventId': { $toObjectId: "$matchId" }
        }
      },
      {
        "$lookup": {
          "from": "inplayevents",
          "localField": "inPlayEventId",
          "foreignField": "_id",
          "as": "matches"
        }
      },
      {
        "$unwind": "$matches"
      },
      {
        $group: {
          _id: "$matches._id",
          "name": {
            "$first": "$matches.name"
          },
          "sportsId": {
            "$first": "$matches.sportsId"
          },
          "Id": {
            "$first": "$matches.Id"
          },
          "marketId": {
            "$first": "$matches.marketIds"
          },
          amount: {
            $sum: "$exposureAmount"
          }
        }
      }
    ], (err, currentPositionData) => {
      if (err) {
        const response = {
          success: false,
          message: 'Failed to get data',
          error: err,
        };
        res.send(response);
      } else {
        const response = {
          success: true,
          message: 'current position records',
          results: currentPositionData
        };
        res.send(response);
      }
    });
  } catch (err) {
    //console.log("current positiion Error ============= ", err);
    const response = {
      success: true,
      message: `current position error ${err}`,
    }
    res.send(response);
  }
}
const saveCurrentPositionTest = async (req, res) => {
  const {  ObjectId } = require('mongodb');  // Import ObjectId here

    
  let maxAmount = 0;
  const finalShareAmountInLoss = 80
  const userCommission = 80
  const userId =45860 
  const dealerId = userId
  const betId = new ObjectId('677eaa298cee96f7abe52fe8');
  const bet = await Bets.findOne({
    _id:betId
  });
  console.log("bet----------",bet);
  try {
    
      

    let newMainAmount = finalShareAmountInLoss;
    console.log("newMainAmount---------------------->>",newMainAmount);
    console.log("dealerId:",dealerId);
    console.log("bet.marketId:",bet.marketId);
    console.log("event:",bet.event);
    console.log("bet.eventId,:",bet.eventId);
    console.log("bet.subMarketId:",bet.subMarketId);
    console.log("bet.betSession:",bet.betSession);


    const prevCurrentPosition2 = await CurrentPosition2.findOne({
      userId:dealerId, 
      marketId:bet.marketId,
      event:bet.event,
      eventId:bet.eventId,
      subMarketId:bet.subMarketId,
      betSession:bet.betSession}).sort({ _id: -1 }).limit(1);
    console.log("prevCurrentPosition2----",prevCurrentPosition2);
    if(prevCurrentPosition2 >0 ){
      // let
      const prevBet = await Bets.find({
        marketId: bet.marketId,
        userId: bet.userId,
        subMarketId: bet.subMarketId,
        betSession: bet.betSession,
        calculateExp:false
      })
        .sort({ _id: -1 })
        .limit(1);
        let prevrunnersPosition
        let prevhighestAmount = 0;
        console.log("previous bet details:",prevBet);
        if (Array.isArray(prevBet) && prevBet.length > 0) {
          const betOld = prevBet[0];
           prevrunnersPosition = betOld.runnersPosition;
          console.log("prevrunnersPosition....",prevrunnersPosition);
          if (bet.subMarketId == '7') {
            console.log("1------------------------------------");
             prevhighestAmount = prevrunnersPosition.length > 0 
            ? Math.max(...prevrunnersPosition.map(runner => runner.position)) 
            : 0;
          }else{
            
             prevhighestAmount = prevrunnersPosition.length > 0 
  ? Math.max(...prevrunnersPosition.map(runner => runner.amount)) 
  : 0;
  console.log("2------------------------------------",prevhighestAmount);

          }
          let prevBetfinalShareAmountInLoss = 0
          if(prevhighestAmount>0){
            console.log("3------------------------------------",prevhighestAmount);
            prevBetfinalShareAmountInLoss = (userCommission/100) * prevhighestAmount
            console.log("4------------------------------------",prevBetfinalShareAmountInLoss);

            console.log("5------------------------------------",prevCurrentPosition2.amount);
            newMainAmount = (prevCurrentPosition2.amount-prevBetfinalShareAmountInLoss ) + finalShareAmountInLoss
            console.log("6------------------------------------",newMainAmount);
          }else{
            console.log("7------------------------------------",prevCurrentPosition2.amount);
            newMainAmount = prevCurrentPosition2.amount + finalShareAmountInLoss
          }
          
        }else{
          newMainAmount = prevCurrentPosition2.amount + finalShareAmountInLoss
        }

    }
    console.log("newMainAmount-----------4----------->>",newMainAmount);
    if(newMainAmount<0)
    {
      newMainAmount =0;
    }
  


    
    
    console.log("current bet.runnersPosition----------------------------------------------------",bet.runnersPosition);
    const runnersPosition = bet.runnersPosition;
     // You seem to be using userId as dealerId

    let newAmount;
    for (const position of runnersPosition) {
      // Apply userCommission based on the subMarketId condition


      if (bet.subMarketId == '7') {
        console.log("bet.subMarketId---------------7",bet.subMarketId);
        newAmount = position.position * (userCommission / 100);
      } else {
        console.log("bet.subMarketId---------------ELSE SUBMARKET...",bet.subMarketId);
        console.log("position.amount-------------------------------",position.amount);
        newAmount = position.amount * (userCommission / 100);
      }

      newAmount = -newAmount; // Change the sign of the amount

      // Step 1: Check if a document already exists
      console.log("newAmount-------------------------------",newAmount);
      const existingDocument = await RunnerWiselossShares.findOne({
        userId: bet.userId,
        dealerId: dealerId,
        marketId: bet.marketId,
        subMarketId: bet.subMarketId,
        betSession: bet.betSession,
        runner: position.runner
      });
      
      if (existingDocument) {
        console.log("existingDocument exisits-------------------------------",existingDocument);
        // Update existing document
        existingDocument.amount = newAmount;
        await existingDocument.save();
      } else {
        console.log("existingDocument DOES NOT exisits-------------------------------");
        // Create new document
        const newDocument = new RunnerWiselossShares({
          betId: bet._id.toString(),
          userId: bet.userId,
          dealerId: dealerId,
          marketId: bet.marketId,
          subMarketId: bet.subMarketId,
          betSession: bet.betSession,
          runner: position.runner,
          amount: newAmount
        });
        await newDocument.save();
      }
    }


    console.log("bet.marketId---",bet.marketId);
    console.log("bet.subMarketId---",bet.subMarketId);
    console.log("userId---",userId);
    console.log("betSession---",bet.betSession);
    let betSession
    let subMarketId
    if(bet.subMarketId){
      subMarketId = bet.subMarketId.toString
    }else{
      subMarketId =bet.subMarketId
    }
    if(bet.betSession!=null){
      betSession = bet.betSession.toString
    }else{
      betSession = bet.betSession
    }
     
    let summarizedResults
    try{
      console.log("----------------insdie..........");
     summarizedResults = await RunnerWiselossShares.aggregate([
      {
        $match: {
          dealerId: userId, // Ensure userId matches exactly in the collection (check data type)
          marketId: bet.marketId, // Ensure bet.marketId is of the same type as in the documents
          subMarketId: subMarketId, // Ensure bet.subMarketId matches exactly
          betSession: betSession // Ensure bet.betSession matches the field in the document

        }
      },
      {
        $group: {
          _id: {
            dealerId: "$dealerId", // Group by dealerId
            marketId: "$marketId", // Group by marketId
            subMarketId: "$subMarketId", // Group by subMarketId
            betSession: "$betSession", // Group by betSession
            runner: "$runner" // Group by runner
          },
          totalAmount: { $sum: "$amount" } // Sum the amount
        }
      }
    ]);
  } catch (error) {
    console.error("fetching summarrize results error::", error);
  }


    // Step 3: Update the summarized amounts in the 'bets' collection
    let index = 0;
    console.log("summarizedResults--------------------",summarizedResults);
    await CurrentPosition2.deleteOne(
      { userId:dealerId,sportsId:bet.sportsId, marketId:bet.marketId,eventId:bet.eventId,subMarketId:bet.subMarketId,betSession:bet.betSession },
      
    );
    

    for (const summary of summarizedResults) {
      const { dealerId, marketId, runner } = summary._id;
      const totalAmount = summary.totalAmount;
      console.log("summary.totalAmount=============",totalAmount);
      console.log("totalAmount=============",totalAmount);
      console.log("newMainAmount=============",newMainAmount);
      // Update the 'bets' collection with the summed amount
      await CurrentPosition2.updateOne(
        { userId:dealerId,sportsId:bet.sportsId, marketId,event:bet.event,eventId:bet.eventId,subMarketId:bet.subMarketId,betSession:bet.betSession },
        {
          $set: {
            "amount":newMainAmount,
            "loosingAmount":newMainAmount,
            "maxWinningAmount":newMainAmount,
            [`runnersPosition.${index}.amount`]: totalAmount,
            [`runnersPosition.${index}.runner`]: runner
          }
        },
        {
          arrayFilters: [{ "elem.runner": runner }],
          upsert: true  // Ensure the document is created if it doesn't exist
        }
      );
      if (totalAmount < maxAmount) {
        maxAmount = totalAmount;
      }

      index++
    }

  } catch (error) {
    console.error("Server error:", error);
  }
  console.log("maxAmount from the summary.................:::",maxAmount);
  
  await CurrentPosition2.updateOne({ marketId: bet.marketId,subMarketId:bet.subMarketId,betSession:bet.betSession,userId:userId }, 
    { amount:maxAmount });
  


};

async function handleWinningBetXX_test() {
  const bet = await Bets.findOne({
    userId: 46301,
    marketId: '4 over run ENG W'
  });
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;
  console.error('00000000000000000000');
  while (retries < maxRetries) {
  try {
    console.log(`Transaction attempt: ${retries + 1}`);
    session.startTransaction();
        const userId = bet.userId;
        console.error('1111111111111111111111111111');
        const userToUpdate= await User.findOne({
          userId: userId,
          isDeleted: false
        });
        //console.log("userToUpdate",userToUpdate);
        console.error('22222222222222222');
        if (!userToUpdate) {
          console.error('Error: user not found Location:(_handle winning bet)');
          return;
        } else {
          console.error('33333333333333333333');
          console.error('444444444444444444');
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
            }else{
              
              
              const lowerRunners = runnersPosition.filter(entry => entry.runner < resultData);
            const higherRunners = runnersPosition.filter(entry => entry.runner > resultData);
          
            // Find the closest lower and higher runners
            const closestLower = lowerRunners.reduce((prev, curr) =>
              Math.abs(curr.runner - resultData) < Math.abs(prev.runner - resultData) ? curr : prev,
              { runner: -Infinity, position: null }
            );
          
            const closestHigher = higherRunners.reduce((prev, curr) =>
              Math.abs(curr.runner - resultData) < Math.abs(prev.runner - resultData) ? curr : prev,
              { runner: Infinity, position: null }
            );
          
            console.log("Closest Lower Runner:", closestLower);
            console.log("Closest Higher Runner:", closestHigher);
              
              if(closestLower.position===closestHigher.position){
                winningAmount = closestHigher
              }
              
              console.log("Winning Amount in targetRunner ELSE:", winningAmount);
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
            console.log('=====================handleWinningBet exists in deposits=====================');
            console.log(bet._id, bet.status);
            console.log('=====================handleWinningBet exists in deposits=====================');

            return;
          }
          let expPositiveData;
      
          
         let updateavailableBalance
         let commissionAmount = 0
         let updateUserExposure   
         let UpdatedclientPL 
         let UpdatedBalance
         updateUserExposure = Number(userToUpdate.exposure + Math.abs(lowestPosition))
         updateavailableBalance = Number(userToUpdate.availableBalance)
         UpdatedclientPL = Number(userToUpdate.clientPL)
         UpdatedBalance = Number(userToUpdate.balance)
         expPositiveData = await expPositive.findOne({ userId:userToUpdate.userId,betId:bet._id.toString() ,calculateExp:true }).sort({ _id: -1 });
         console.log("winningAmount--------------------------------",winningAmount);
         if (winningAmount>0){
          availableBalance2  = Math.abs(expPositiveData.expCaptured) + winningAmount + userToUpdate.availableBalance
          commissionAmount = 0.02*winningAmount
          updateavailableBalance = Number(userToUpdate.availableBalance + Math.abs(expPositiveData.expCaptured) + winningAmount)
          UpdatedclientPL = Number(userToUpdate.clientPL + (winningAmount))
          UpdatedBalance = Number(userToUpdate.balance + (winningAmount))
          
          }else if (winningAmount<0){
         
            availableBalance2  = userToUpdate.availableBalance
            UpdatedclientPL = Number(userToUpdate.clientPL + (winningAmount))
            UpdatedBalance = Number(userToUpdate.balance + (winningAmount))
            updateavailableBalance = Number (userToUpdate.availableBalance + Math.abs(expPositiveData.expCaptured) + (winningAmount) )
            
            }else if (winningAmount==0){
              availableBalance2  = Math.abs(expPositiveData.expCaptured) + userToUpdate.availableBalance
              updateavailableBalance = Number(userToUpdate.availableBalance + Math.abs(expPositiveData.expCaptured))
              
              
              }
         
         console.log("UpdatedBalance user----",UpdatedBalance);
               console.log("UpdatedclientPL user----",UpdatedclientPL);
               console.log("updateUserExposure user----",updateUserExposure);
               console.log("updateavailableBalance user----",updateavailableBalance);
               console.log("userToUpdate.tempExposure.......",userToUpdate.tempExposure);
               console.log("expPositiveData.expCaptured.......",expPositiveData.expCaptured);
               console.log("updateUserExposure----",updateUserExposure);
               console.log("updateavailableBalance----",updateavailableBalance);
               console.log("userId:",userId);
       
          // await User.updateOne(
          //   {
          //     userId: userToUpdate.userId,
          //     isDeleted: false
          //   },
          //   {
          //     balance: UpdatedBalance,
          //     clientPL: UpdatedclientPL,
          //     // tempExposure : userToUpdate.tempExposure + Math.abs(expPositiveData.expCaptured),
          //     // availableBalance2:availableBalance2,
          //     // exposure: updateUserExposure,
          //     availableBalance: updateavailableBalance
          //   },{ session }
          // );


          await User.updateOne(
            { userId: userToUpdate.userId, isDeleted: false },
            { $set: { 
              balance: UpdatedBalance,
              clientPL: UpdatedclientPL,
              tempExposure : userToUpdate.tempExposure + Math.abs(expPositiveData.expCaptured),
              availableBalance2:availableBalance2,
              exposure: updateUserExposure,
              availableBalance: updateavailableBalance } }
          );
    
      




          console.log("After fancy user updated.....");
          
          if(expPositiveData){
            await expPositive.updateOne(
              {
                userId:userToUpdate.userId,betId:bet._id.toString(),roundId:bet.marketId
              },
              {
    
                
                expReleasedC:Math.abs(expPositiveData.expCaptured),
                updatedAt:Date.now(),
                diff:winningAmount,
                BFavailableBalance: userToUpdate.availableBalance,
                AFavailableBalance:availableBalance2,
    
                AbAtRelease:updateavailableBalance
                
              }
            );
          }
          console.log("After fancy expPositiveData updated.....");
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
       
          }]);
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
            
            for (const user of parentUser) {
              console.log("before SettleParentsSettleParentsSettleParentsSettleParentsSettleParentsSettleParents");
              await SettleParents(user,bet,winningAmount,session)
              
            
          }//end parents for loop
        }//end parents Else
      
      
      
      
      
        
        }
      
      
      
      
      
      
    
          await session.commitTransaction();
      break; // Exit loop if transaction succeeds
  } catch (error) {
    await session.abortTransaction();
    console.log(error,"==============================================================================");
    if ( retries < maxRetries) {
      retries++;
      console.log(`Retrying transaction...calculation3 attempt ${retries}`);
      continue; // Retry the transaction
    } else {
      
      console.error('Transaction Error:', error);
      //await session.abortTransaction();
      //break; // Exit loop if error is not transient

    }
  }finally {
    session.endSession();
  }
}//end while loop
}

loginRouter.get('/handleWinningBetXX_test', handleWinningBetXX_test);
loginRouter.get('/getCurrentPosition', getCurrentPosition);
loginRouter.get('/currentPositionDetails', currentPositionDetails);
loginRouter.get('/currentPositionDetails3', currentPositionDetails3);
loginRouter.get('/battorcurrentPosition', battorcurrentPosition);
loginRouter.get('/getCurrentPosition2', getCurrentPosition2);
loginRouter.get('/getCurrentPosition3', getCurrentPosition3);
loginRouter.get('/saveCurrentPositionTest', saveCurrentPositionTest);
loginRouter.get('/gethighlights', getHighlights);

module.exports = { loginRouter };

