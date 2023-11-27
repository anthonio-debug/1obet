const express = require("express");
const router = express.Router();
const Bets = require("../models/bets");

async function listBet(req, res) {
  try {
    const userId = req.params.userId;
    const betList = await Bets.aggregate([
      {
        $match: {
          userId: parseInt(userId),
        },
      },
      {
        $lookup: {
          from: "deposits",
          localField: "_id",
          foreignField: "betId",
          as: "depositDetail",
        },
      },
      {
        $lookup: {
          from: "exposures",
          localField: "randomStr",
          foreignField: "trans_from_id",
          as: "exposureDetail",
        },
      },
      {
        $project: {
          _id: 0,
          price: "$betRate",
          runnersPosition: "$runnersPosition",
          calculateExp: "$calculateExp",
          runnerId: "$runnerName",
          createdAt: "$createdAt",
          size: "$betAmount",
          runner: "$runner",
          marketId: "$marketId",
          betRate: "$betRate",
          type: "$type",
          isfancyOrbookmaker: "$isfancyOrbookmaker",
          fancyData: "$fancyData",
          bettor: "$userDetails.userName",
          bettorId: "$userDetails.userId",
          fancyRate: "$fancyRate",
          betSession: "$betSession",
          roundId: "$roundId",
          depositDetail: "$depositDetail",
          exsposureDetail: "$exposureDetail",
        },
      },
    ]);

    res.status(200).json({ success: true, data: betList });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get bet list" });
  }
}

router.get("/listBet/:userId", listBet);

module.exports = { router };
