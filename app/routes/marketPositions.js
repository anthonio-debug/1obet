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

    const childsDealer = { createdBy: currentUserId };
    const [childUserDealer, childUserTrader] = await Promise.all([
      User.distinct("userId", { ...childsDealer, role: { $ne: "5" } }),
      User.distinct("userId", { ...childsDealer, role: { $eq: "5" } })
    ]);


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
              as: "userInfo"
            }
          },
          {
            $unwind: "$userInfo"
          },
          {
            $group: {
              _id: "$userId",
              role: { $first: "$userInfo.role" },
              name: { $first: "$userInfo.userName" },
              amount: { $sum: "$amount" },
              upLineAmount: { $sum: "$upLineAmount" }
            }
          },
          {
            $sort: { "role": -1 }
          },
          {
            $setWindowFields: {
              partitionBy: "$_id",
              sortBy: { role: -1 },
              output: {
                cumulativeAmount: { $sum: "$amount", window: { documents: ["unbounded", "current"] } },
                cumulativeUpLineAmount: { $sum: "$upLineAmount", window: { documents: ["unbounded", "current"] } }
              }
            }
          },
          {
            $group: {
              _id: null,
              data: {
                $push: {
                  _id: "$_id",
                  role: "$role",
                  name: "$name",
                  amount: "$amount",
                  upLineAmount: "$upLineAmount",
                  cumulativeAmount: "$cumulativeAmount",
                  cumulativeUpLineAmount: "$cumulativeUpLineAmount"
                }
              }
            }
          },
          {
            $unwind: "$data"
          },
          {
            $replaceRoot: { newRoot: "$data" }
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
          userId: { $in: [currentUserId, parentUserId] },
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
          as: "userInfo"
        }
      },
      {
        $unwind: "$userInfo"
      },
      {
        $group: {
          _id: "$userId",
          role: { $first: "$userInfo.role" },
          name: { $first: "$userInfo.userName" },
          amount: { $sum: "$amount" },
          upLineAmount: { $sum: "$upLineAmount" }
        }
      },
      {
        $sort: { "role": -1 }
      },
      {
        $setWindowFields: {
          partitionBy: "$_id",
          sortBy: { role: -1 },
          output: {
            cumulativeAmount: { $sum: "$amount", window: { documents: ["unbounded", "current"] } },
            cumulativeUpLineAmount: { $sum: "$upLineAmount", window: { documents: ["unbounded", "current"] } }
          }
        }
      },
      {
        $group: {
          _id: null,
          data: {
            $push: {
              _id: "$_id",
              role: "$role",
              name: "$name",
              amount: "$amount",
              upLineAmount: "$upLineAmount",
              cumulativeAmount: "$cumulativeAmount",
              cumulativeUpLineAmount: "$cumulativeUpLineAmount"
            }
          }
        }
      },
      {
        $unwind: "$data"
      },
      {
        $replaceRoot: { newRoot: "$data" }
      }
    ]);

    const currentUserResponse = await marketPositionRecord([currentUserId]);
    const parentUserResponse = parentUserId ? parentUserRecord : [];
    const childUserDealerResponse = childUserDealer.length > 0 ? await marketPositionRecord(childUserDealer) : [];
    const childUserTraderResponse = childUserTrader.length > 0 ? await marketPositionRecord(childUserTrader) : [];

    const response = [...childUserDealerResponse, ...childUserTraderResponse, ...currentUserResponse, ...parentUserResponse];

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
