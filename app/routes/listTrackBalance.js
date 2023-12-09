const express = require("express");
const router = express.Router();
const Bets = require("../models/bets");

async function listTrackBalance(req, res) {
  try {
    const userId = parseInt(req.params.userId);

    const betList = await Bets.aggregate([
      {
        $match: {
          userId: userId,
          calculateExp: true,
        },
      },
      {
        $lookup: {
          from: "deposits",
          localField: "userId",
          foreignField: "userId",
          as: "depositDetail",
        },
      },
      {
        $unwind: "$depositDetail",
      },
      {
        $lookup: {
          from: "inplayevents",
          localField: "depositDetail.matchId",
          foreignField: "_id",
          as: "eventDetail",
        },
      },
      {
        $match: {
          "depositDetail.userId": userId,
        },
      },
      {
        $group: {
          _id: {
            marketId: "$marketId",
            eventId: "$eventDetail.Id",
            userId: "$userId",
          },
          position: { $first: "$position" },
          totalDeposit: { $sum: "$depositDetail.amount" },
          data: { $first: "$$ROOT" },
        },
      }
    ]);
    
    res.status(200).json({ success: true, data: betList, total: total, isBalanceMatching: isBalanceMatching });
  } catch (err) {
    res.status(500).json({ success: false, msg: `Failed to get bet list:  ${err.message}` });
  }
}

router.get("/listTrackBalance/:userId", listTrackBalance);

module.exports = { router };