const express = require("express");
const { validationResult } = require("express-validator");
const User = require("../models/user");
const Deposits = require("../models/deposits");
const loginRouter = express.Router();

const getMarketPositions = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId, betId } = req.body;

  const currentUser = await User.findOne({ userId });
  if (!currentUser) {
    console.error(`Current user not found for userId: ${userId}`);
    return res.status(404).json({ success: false, message: "Current user not found." });
  }

  const parentUser = await User.findOne({ userId: currentUser.createdBy });
  const childUserIds = await User.distinct("userId", { createdBy: userId });
  
  if (childUserIds.length == 0) return res.status(400).send({ message: "Trader has no child" })

  const betNComission = ["Bet", "loosing", "Settlement"];

  const traderResponse = await Deposits.aggregate([
    {
      $match: {
        betId: betId,
        cashOrCredit: { $in: betNComission },
        userId: { $in: childUserIds },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "userId",
        as: "userInfo",
        pipeline: [
          { $project: { userId: 1, userName: 1, role: 1 } }
        ],
      },
    },
    { $unwind: "$userInfo" },
    {
      $group: {
        _id: "$userId",
        name: { $first: "$userInfo.userName" },
        role: { $first: "$userInfo.role" },
        amount: { $sum: "$amount" },
      },
    },
    {
      $sort: {
        role: -1
      }
    }
  ]);

  const dealersIds = parentUser === null ? [currentUser.userId] : [currentUser.userId, parentUser?.userId]
  const dealerResponse = await Deposits.aggregate([
    {
      $match: {
        betId: betId,
        cashOrCredit: { $in: betNComission },
        userId: { $in: dealersIds },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "userId",
        as: "userInfo",
        pipeline: [
          { $project: { userId: 1, userName: 1, role: 1 } }
        ],
      },
    },
    { $unwind: "$userInfo" },
    {
      $group: {
        _id: "$userId",
        name: { $first: "$userInfo.userName" },
        role: { $first: "$userInfo.role" },
        amount: { $sum: "$amount" },
      },
    }, {
      $sort: {
        role: -1
      }
    }
  ]);

  const childAmount = dealerResponse.length == 2 ? dealerResponse[0]?.amount + dealerResponse[1]?.amount : dealerResponse[0]?.amount
  traderResponse[0].amount = - childAmount
  const response = [...traderResponse, ...dealerResponse]
  return res.status(200).json({
    success: true,
    message: "Market Positions Reports!",
    results: response,
  });
};

loginRouter.post("/marketPositions", getMarketPositions);

module.exports = { loginRouter };
