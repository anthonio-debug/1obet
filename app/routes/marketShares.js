const express = require("express");
const { validationResult } = require("express-validator");
const CashDeposit = require("../models/deposits");
const User = require("../models/user");
let mongoose = require('mongoose');
const Bets = require("../models/bets");
const MarketIDS = require("../models/marketIds");
const AsianResult = require("../models/asianTablesResultsHistory")
const loginRouter = express.Router();

const marketGainWithDuplicates = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userId = Number(req.query.userId);
  const marketId = req.query.marketId;
  const depositId = mongoose.Types.ObjectId(req.query.depositId);
  let asianWinner = ''

  // const condition = { marketId: marketId }
  // "" + marketId == "null" ? [{ sportsId: "6" }, { sportID: 6 }] : { marketId: marketId };

  const currentUser = await User.findOne({ userId: userId });
  let depositRes;

  if (currentUser?.role == 5) {
    const marketData = await MarketIDS.findOne({ marketId: marketId });

    const parent = await User.findOne({ userId: currentUser.createdBy });

    if (marketId != "none") {

      depositRes = await CashDeposit.findOne({
        marketId: marketId,
        // betId: betId,
        _id: depositId,
        $or: [
          {
            $and: [
              {
                userId: userId,
              },
              {
                cashOrCredit: { $in: ["Bet"] },
              },
            ],
          },
          {
            cashOrCredit: { $in: ["Commission"] },
          },
        ],
      });
    } else {
      depositRes = await CashDeposit.findOne({
        _id: depositId
      });
    }

    if (!depositRes)
      return res.status(404).send({ message: "Cannot find desposit" });

    let response = {
      _id: depositRes.betId,
      pl: depositRes.amount,
      sattledAt: depositRes.date,
      sportsId: depositRes.sportsId,
    };

    if(depositRes.sportsId == "6"){
      response.Commission = depositRes?.amount > 0 ? depositRes?.amount * 0.02 : 0;
      response.netPl   = depositRes?.amount > 0 ? depositRes?.amount *  ( 100/98 ) : depositRes?.amount;
      response.result  = depositRes?.amount > 0 ? "WON" : "LOSS";
      
    }

    if (marketId != "none" && depositRes.sportsId != "6") {
      const betRes = await Bets.findOne({ _id: depositRes.betId });
      response.price = betRes.betAmount;
      response.name = betRes.runnerName;
      response.createdAt = betRes.createdAt;
      response.size = betRes.betRate;
      response.type = betRes.type;
      response.isfancyOrbookmaker = betRes.isfancyOrbookmaker;
      response.fancyData = betRes.fancyData;
      response.matchType = betRes?.matchType;
      response.SessionScore = betRes?.SessionScore;
      response.winnerRunnerData = betRes?.winnerRunnerData;
      response.resultData = betRes?.resultData
      response.roundId = betRes?.roundId
      response.fancyData = betRes?.fancyData
      response.isfancyOrbookmaker = betRes?.isfancyOrbookmaker

      if(!marketData?.winnerInfo){
        const resultInfo = await AsianResult.findOne({ roundId: betRes?.roundId })
        if (resultInfo?.tableId == "teen20"){
          if (resultInfo?.result[0]?.win == "1") {
            asianWinner = "Player A Cards"
          } else {
            asianWinner = "Player B Cards"
          }
        } else if (resultInfo?.tableId == "lucky7eu"){
            asianWinner = "Card " + " " + resultInfo?.result[0]?.cards[0]
        } else if (resultInfo?.tableId == "aaa"){
          asianWinner = "Card " + " " + resultInfo?.result[0]?.cards[0]
        } else if (resultInfo?.tableId == "card32eu"){
          const generalResult = resultInfo?.result[0]?.desc.split("|");
          asianWinner = generalResult[0]
        } 
      }
    }


    return res.send({
      success: true,
      message: "Market Shares Reports by MarketId",
      results: response,
      isDetailed: true,
      dealer: parent.userName,
      currentUser: currentUser.userName,
      Winner: marketData?.winnerInfo ? marketData?.winnerInfo : asianWinner,
    });

  } else {
    const childUsers = await User.distinct("userId", { createdBy: userId });
    const users = [userId, ...childUsers];
    console.log(" users ===================  ", users);

    const response = await CashDeposit.aggregate([
      {
        $match: {
          userId: {
            $in: users,
          },
          ...condition[0],
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "userId",
          as: "userInfo",
        },
      },
      {
        $group: {
          _id: "$userId",
          amount: { $sum: "$amount" },
          name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } },
        },
      },
    ]);

    return res.send({
      success: true,
      message: "Commission reports",
      results: response,
    });
  }
};

loginRouter.get("/marketShares", marketGainWithDuplicates);

module.exports = { loginRouter };
