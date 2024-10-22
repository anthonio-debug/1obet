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

  let parentUserResponse = [];
  const parentUser = await User.findOne({ userId: currentUser.createdBy });

  const childUserIds = await User.distinct("userId", { createdBy: userId });
  const betNComission = ["Bet", "Commission", "loosing", "Settlement"];

  const currentUserResponse = await Deposits.aggregate([
    {
      $match: {
        userId: currentUser.userId,
        cashOrCredit: { $in: betNComission },
        betId: betId,
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
    { $unwind: "$userInfo" },
    {
      $group: {
        _id: "$userId",
        name: { $first: "$userInfo.userName" },
        role: { $first: "$userInfo.role" },
        amount: { $sum: "$amount" },
      },
    },
  ]);

  if (parentUser) {
    parentUserResponse = await Deposits.aggregate([
      {
        $match: {
          userId: parentUser.userId,
          cashOrCredit: { $in: betNComission },
          betId: betId,
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
      { $unwind: "$userInfo" },
      {
        $group: {
          _id: "$userId",
          name: { $first: "$userInfo.userName" },
          amount: { $sum: "$upLineAmount" },
          role: { $first: "$userInfo.role" },
        },
      },
    ]);
  }

  const childAmount = parentUserResponse[0].amount + currentUserResponse[0].amount

  const childResponse = await Deposits.aggregate([
    {
      $match: {
        userId: { $in: childUserIds },
        cashOrCredit: { $in: betNComission },
        betId: betId,
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
    { $unwind: "$userInfo" },
    {
      $group: {
        _id: "$userId",
        name: { $first: "$userInfo.userName" },
        amount: { $sum: "$amount" },
        role: { $first: "$userInfo.role" },
      },
    },
  ]);
  childResponse[0].amount = - childAmount
  const response = [...childResponse, ...currentUserResponse, ...parentUserResponse];

  console.log("Final response:", response);

  return res.status(200).json({
    success: true,
    message: "Market Positions Reports!",
    results: response,
  });
};

loginRouter.post("/marketPositions", getMarketPositions);

module.exports = { loginRouter };
