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
          foreignField: userId,
          as: "depositDetail",
        },
      },
      {
        $unwind: "$depositDetail",
      },
      {
        $lookup: {
          from: "Events",
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
          _id: "$_id",
          position: { $first: "$position" }, // Assuming position is the field that represents exposure in the bets collection
          totalDeposit: { $sum: "$depositDetail.amount" },
          data: { $first: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: 0,
          betId: "$data._id",
          price: "$data.betRate",
          runnersPosition: "$data.runnersPosition",
          calculateExp: "$data.calculateExp",
          runnerId: "$data.runnerName",
          createdAt: "$data.createdAt",
          size: "$data.betAmount",
          runner: "$data.runner",
          marketId: "$data.marketId",
          betRate: "$data.betRate",
          type: "$data.type",
          isfancyOrbookmaker: "$data.isfancyOrbookmaker",
          fancyData: "$data.fancyData",
          fancyRate: "$data.fancyRate",
          betSession: "$data.betSession",
          roundId: "$data.roundId",
          asianTableId: "$data.asianTableId",
          marketId: "$data.marketId",
          betAmount: "$data.betAmount",
          exposureAmount: "$data.exposureAmount",
          sportsId: "$data.sportsId",
          totalDeposit: 1,
          position: 1,
        },
      },
    ]);

    const total = await Bets.countDocuments({ userId: userId, calculateExp: true });

    // Check if totalDeposit is equal to the position for each bet
    const isBalanceMatching = betList.every((bet) => bet.totalDeposit === bet.position);

    res.status(200).json({ success: true, data: betList, total: total, isBalanceMatching: isBalanceMatching });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get bet list" });
  }
}

router.post("/listTrackBalance/:userId", listTrackBalance);

module.exports = { router };