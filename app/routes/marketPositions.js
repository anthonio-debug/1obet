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

  if (!betId) {
    return res.status(404).json({ success: false, message: "BetId not found." });
  }

  try {
    const currentUser = await User.findOne({ userId });
    if (!currentUser) {
      console.error(`Current user not found for userId: ${userId}`);
      return res.status(404).json({ success: false, message: "Current user not found." });
    }

    let parentUserResponse = [];
    const parentUser = await User.findOne({ userId: currentUser.createdBy });
    const childUserIds = await User.distinct("userId", { createdBy: userId });

    const currentUserResponse = await Deposits.aggregate([
      {
        $match: {
          userId: currentUser.userId,
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


    let childResponse = await Deposits.aggregate([
      {
        $match: {
          userId: { $in: childUserIds },
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

    if (childResponse[0]?.role === "5") {
      let traderFields = await Deposits.aggregate([
        {
          $match: {
            userId: childResponse[0]._id,
            betId: betId,
          },
        },
        {
          $project: {
            _id: 0,
            marketId: 1,
            depositId: 1,
            roundId: 1,
            sportsId: 1,
            matchId: 1,
            betSession: 1,
          },
        },
      ]);

      if (traderFields[0]) {
        childResponse[0] = { ...childResponse[0], ...traderFields[0] };
      }
    }

    console.log("childResponse before", childResponse)
    console.log(childResponse)
    console.log("parentUserResponse[0].amount", parentUserResponse[0]?.amount ? parentUserResponse[0]?.amount : 0)
    const childAmount = (parentUserResponse[0]?.amount ? parentUserResponse[0]?.amount : 0) + currentUserResponse[0].amount
    console.log("childResponse[0].amount Before:", childResponse[0].amount)
    childResponse[0].amount = - childAmount
    console.log("childResponse[0].amount After:", childResponse[0].amount)
    const response = [...childResponse, ...currentUserResponse, ...parentUserResponse];

    return res.status(200).json({
      success: true,
      message: "Market Positions Reports!",
      results: response,
    });
  } catch (error) {
    console.error("Error fetching market positions:", error);
    return res.status(500).json({ success: false, message: "An error occurred while fetching market positions" });
  }
};

loginRouter.post("/marketPositions", getMarketPositions);

module.exports = { loginRouter };