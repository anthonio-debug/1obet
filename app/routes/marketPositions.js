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

  if (!betId){
    return res.status(404).json({ success: false, message: "BetId is not found." });
  }
  const currentUser = await User.findOne({ userId }, { userId: 1, createdBy: 1 });
  if (!currentUser) {
    return res.status(404).json({ success: false, message: "Current user not found." });
  }

  const parentUserPromise = User.findOne({ userId: currentUser.createdBy }, { userId: 1 });
  const childUserIdsPromise = User.distinct("userId", { createdBy: userId });

  const [parentUser, childUserIds] = await Promise.all([parentUserPromise, childUserIdsPromise]);

  if (childUserIds.length === 0) {
    return res.status(400).send({ message: "Trader has no child" });
  }

  const betNComission = ["Bet", "loosing", "Settlement"];

  const traderResponsePromise = Deposits.aggregate([
    {
      $match: {
        betId,
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
    { $sort: { role: -1 } },
  ]);

  const dealersIds = parentUser ? [currentUser.userId, parentUser.userId] : [currentUser.userId];
  const dealerResponsePromise = Deposits.aggregate([
    {
      $match: {
        betId,
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
    },
    { $sort: { role: -1 } },
  ]);

  const [traderResponse, dealerResponse] = await Promise.all([traderResponsePromise, dealerResponsePromise]);

  const childAmount = dealerResponse.length === 2
    ? dealerResponse[0]?.amount + dealerResponse[1]?.amount
    : dealerResponse[0]?.amount;

  if (traderResponse.length > 0) {
    traderResponse[0].amount = -childAmount;
  }

  const response = [...traderResponse, ...dealerResponse];

  return res.status(200).json({
    success: true,
    message: "Market Positions Reports!",
    results: response,
  });
};

loginRouter.post("/marketPositions", getMarketPositions);

module.exports = { loginRouter };
