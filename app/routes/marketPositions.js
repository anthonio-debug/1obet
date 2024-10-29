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

  try {
    const { userId, betId } = req.body;

    if (!betId) {
      console.warn("BetId not provided");
      return res.status(404).json({ success: false, message: "BetId not found." });
    }

    const deposit = await Deposits.findOne({ betId });
    if (!deposit) {
      console.warn(`No deposit found for betId: ${betId}`);
      return res.status(404).json({ success: false, message: "No deposit found for BetId." });
    }
    const { sportsId, matchId, marketId, betSession, roundId } = deposit;

    const currentUser = await User.findOne({ userId });
    if (!currentUser) {
      console.warn(`User not found for userId: ${userId}`);
      return res.status(404).json({ success: false, message: "Current user not found." });
    }
    const { userId: currentUserId, createdBy: parentUserId } = currentUser;

    const childUserIds = await User.distinct("userId", { createdBy: currentUserId });
    if (childUserIds.length === 0) {
      console.info(`No child users found for userId: ${currentUserId}`);
    }

    const marketPositionRecord = async (userIds) => {
      try {
        return await Deposits.aggregate([
          {
            $match: {
              userId: { $in: userIds },
              cashOrCredit: { $in: ["Bet", "Casino Bet"] },
              matchId,
              marketId,
              betSession,
              roundId,
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
            "$group": {
              "_id": "$userId",
              "name": { "$first": "$userInfo.userName" },
              "role": { "$first": "$userInfo.role" },
              "amount": { "$sum": "$amount" },
            }
          },
          {
            "$sort": {
              "role": -1
            }
          }
        ]);
      } catch (error) {
        console.error("Error in marketPositionRecord aggregation:", error);
        return [];
      }
    };
    const parentUserRecord = await Deposits.aggregate([
      {
        $match: {
          userId: parentUserId,
          cashOrCredit: { $in: ["Bet", "Casino Bet"] },
          matchId,
          marketId,
          betSession,
          roundId,
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
          amount: { $sum: "$upLineAmount" },
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          role: 1,
          amount: { $multiply: ["$amount", -1] }
        }
      },
      { $sort: { role: -1 } }
    ]);

    const currentUserResponse = await marketPositionRecord([currentUserId]);
    const parentUserResponse = parentUserId ? parentUserRecord : [];
    const childResponse = childUserIds.length > 0 ? await marketPositionRecord(childUserIds) : [];

    const response = [...childResponse, ...currentUserResponse, ...parentUserResponse];

    console.debug("Final response structure:", JSON.stringify(response, null, 2));

    return res.status(200).json({
      success: true,
      message: "Market Positions Reports!",
      results: response,
    });
  } catch (error) {
    console.error("Error fetching market positions:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

loginRouter.post("/marketPositions", getMarketPositions);

module.exports = { loginRouter };