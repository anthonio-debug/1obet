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

    const { matchId, marketId, betSession, roundId } = deposit;
    const currentUser = await User.findOne({ userId });
    if (!currentUser) {
      console.warn(`User not found for userId: ${userId}`);
      return res.status(404).json({ success: false, message: "Current user not found." });
    }

    const { userId: currentUserId, createdBy: parentUserId } = currentUser;
    const childUserFilter = { createdBy: currentUserId };

    const [childUserDealer, childUserTrader] = await Promise.all([
      User.distinct("userId", { ...childUserFilter, role: { $ne: "5" } }),
      User.distinct("userId", { ...childUserFilter, role: { $eq: "5" } })
    ]);

    const fetchMarketPosition = async (userIds, isDealer = false) => {
      try {
        return await Deposits.aggregate([
          {
            $match: {
              userId: { $in: userIds },
              cashOrCredit: { $in: ["Bet", "Casino Bet"] },
              matchId, marketId, betSession, roundId,
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "userId",
              as: "userInfo"
            }
          },
          { $unwind: "$userInfo" },
          {
            $group: {
              _id: "$userId",
              role: { $first: "$userInfo.role" },
              name: { $first: "$userInfo.userName" },
              amount: { $sum: isDealer ? "$upLineAmount" : "$amount" },
              upLineAmount: { $sum: "$upLineAmount" }
            }
          },
          { $sort: { "role": -1 } }
        ]);
      } catch (error) {
        console.error("Error in fetchMarketPosition aggregation:", error);
        return [];
      }
    };

    const [currentUserResponse, parentUserRecord, childUserDealerRecord, childUserTraderRecord] = await Promise.all([
      fetchMarketPosition([currentUserId]),
      parentUserId ? fetchMarketPosition([parentUserId]) : [],
      childUserDealer.length > 0 ? fetchMarketPosition(childUserDealer, true) : [],
      childUserTrader.length > 0 ? fetchMarketPosition(childUserTrader) : []
    ]);

    if (parentUserRecord[0]>0) {
      parentUserRecord[0].amount = -(currentUserResponse[0]?.upLineAmount || 0);
    }else{
      parentUserRecord[0].amount = currentUserResponse[0]?.upLineAmount || 0;
    }

    const response = [...childUserDealerRecord, ...childUserTraderRecord, ...currentUserResponse, ...parentUserRecord];

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