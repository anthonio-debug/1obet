const express = require('express');
const mongoose = require('mongoose')
const router = express.Router();
const SettlementLog = require('../models/SettlementLog');
const Bets = require("../models/bets");
const User = require("../models/user");

async function getAllSettlementLogs(req, res) {

    const { query, searchKey = "", sportsId } = req.body;

    console.log(req.body);

    // const options = {
    //     page: page,
    //     limit: limit,
    //     sort: { [sortValue]: sort },
    //     select: projection
    // };

    let pipeline = [];

    pipeline.push(
        {
            $lookup: {
                from: 'marketids',
                localField: "marketId",
                foreignField: 'marketId',
                as: 'marketidinfo'
            }
        },
        { $unwind: '$marketidinfo' },
        {
            $lookup: {
                from: 'inplayevents',
                localField: "marketidinfo.eventId",
                foreignField: 'Id',
                as: 'eventinfo'
            }
        },
        { $unwind: '$eventinfo' },
        {
            "$facet": {
                "totalCount": [{ "$count": "count" }],
                "paginatedResults": [
                    { "$skip": (query?.page - 1) * query?.limit },
                    { "$limit": query?.limit }
                ]
            }
        },
        { $unwind: "$totalCount"}
    )

    // if (searchKey.length > 0) {
    //     pipeline.push(
    //         {
    //             $or: [
    //                 {
    //                     $match: {
    //                         "$marketidinfo.marketName": { $regex: `${searchKey}` }
    //                     }
    //                 },
    //                 {
    //                     $match: {
    //                         "$marketidinfo.markeId": { $regex: `${searchKey}` }
    //                     }
    //                 },
    //                 {
    //                     $match: {
    //                         "type": { $regex: `${searchKey}` }
    //                     }
    //                 }
    //             ]

    //         }
    //     )
    // }




    // if(sportsId) {
    //     pipeline.push(
    //         {
    //             $match: {
    //                 "$marketidinfo.sportID": Number(sportsId)
    //             }
    //         }
    //     )
    // }

    console.log(pipeline);

    let logs = await SettlementLog.aggregate(pipeline);

    console.log(logs);

    return res.status(200).json({
        data: logs[0].paginatedResults,
        totalCount: logs[0].totalCount.count
    })

}

async function rollbackMarket(req, res) {
    const { marketId } = req.params;

    console.log({ marketId });

    const session = await mongoose.startSession();
    session.startTransaction();

    console.log("market rollback started");

    const isUserExist = (user, userArray) => {
        return userArray.indexOf((item) => item.data.userId.equals(user.userId));
    }

    try {
        const logs = await SettlementLog.find({ marketId: marketId, type: "SETTLE" }).session(session);

        if (logs.length == 0) {
            throw new Error(`Settlement log not found with ${marketId}`);
        }

        let affectedBets = [];
        let affectedUsers = [];

        for (const logItem of logs) {

            await SettlementLog.findOneAndUpdate(logItem._id, { type: "ROLLBACKED" }, { session });

            for (const bet of logItem.affectedBets) {
                affectedBets.push(bet);
            }

            for (const user of logItem.balanceChanges) {
                console.log(user.userId);
                let userLocation = isUserExist(user, affectedUsers);
                if (userLocation < 0)
                    affectedUsers.push({
                        data: { ...user },
                        createdAt: logItem.createdAt
                    })
                else {
                    if (new Date(affectedUsers[userLocation].createdAt).getTime() > new Date(logItem.createdAt).getTime()) {
                        affectedUsers[userLocation] = {
                            data: { ...user },
                            createdAt: logItem.createdAt
                        }
                    }
                }
            }
        }

        console.log("extracted affectedbets");
        console.log(affectedBets);

        console.log("extracted affectedUsers");
        console.log(affectedUsers);

        console.log('bet updating...')
        for (const bet of affectedBets) {
            await Bets.findByIdAndUpdate(bet._id, bet, { session });
        }
        console.log("bets updated...");

        console.log('user updating...');
        for (const user of affectedUsers) {
            const balanceChange = user?.data;
            await User.findByIdAndUpdate(balanceChange._id, {
                $set: { balance: balanceChange.balance, availableBalance: balanceChange.availableBalance, exposure: balanceChange.exposure, credit: balanceChange.credit, availableBalance2: balanceChange.availableBalance2 }
            }, { session });
        }
        console.log('users updated...');

        await session.commitTransaction();

        return res.status(200).json({
            success: true,
            message: 'success',
        });
    } catch (err) {
        await session.abortTransaction();
        console.warn(err);
        return res.status(200).json({
            success: false,
            message: 'Error invoked during the operation'
        })
    } finally {
        session.endSession();
    }
}

async function rollback(req, res) {
    const { logId } = req.params;
    const session = await mongoose.startSession();
    session.startTransaction();

    console.log("rollback started");

    try {
        const log = await SettlementLog.findById(logId).session(session);
        await SettlementLog.findByIdAndUpdate(logId, { type: "ROLLBACKED" }, { session })
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
    }
}

router.post('/roll-back/all', getAllSettlementLogs);
router.get('/roll-back/:logId', rollback);
router.get('/roll-back/marketId/:marketId', rollbackMarket);
module.exports = { router, rollback };
