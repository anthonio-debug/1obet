const express = require('express');
const mongoose = require('mongoose')
const router = express.Router();
const SettlementLog = require('../models/SettlementLog');
const Bets = require("../models/bets");
const User = require("../models/user");

async function rollback(req, res) {
    const { logId } = req.params;
    const session = await mongoose.startSession();
    session.startTransaction();

    console.log("rollback started");

    try {
        const log = await SettlementLog.findById(logId).session(session);
        if (!log) throw new Error("Settlement log not found");

        for (const bet of log.affectedBets) {
            await Bets.findByIdAndUpdate(bet._id, bet, { session });
        }

        console.log('bets are updated');

        for (const balanceChange of log.balanceChanges) {
            await User.findByIdAndUpdate(balanceChange._id, {
                $set: { balance: balanceChange.balance, availableBalance: balanceChange.availableBalance, exposure: balanceChange.exposure, credit: balanceChange.credit, availableBalance2: balanceChange.availableBalance2 }
            }, { session });
        }

        console.log("user updated");

        await SettlementLog.create([{
            matchId: log.matchId,
            marketId: log.marketId,
            type: "ROLLBACK",
            settledBy: "admin",
            settledAt: new Date(),
            affectedBets: log.affectedBets,
            balanceChanges: log.balanceChanges,
        }], { session });

        await session.commitTransaction();
        console.log("Rollback complete.");

        return res.json({
            success: true,
            message: 'Rollback Completed',
        });
    } catch (err) {
        console.error("Rollback failed:", err);
        await session.abortTransaction();
        return res.status(200).json({
            success: false,
            message: 'Error rollback',
        });
    } finally {
        session.endSession();
        mongoose.disconnect();
    }
}


router.get('/roll-back/:logId', rollback);
module.exports = { router, rollback };
