'use strict';
module.exports = toolStart;
const apiRequest = require('./apiRequest')();
const MarketIDs = require('../app/models/marketIds');
const inplayevents = require('../app/models/events');

function toolStart() {
    return { init };

    async function init() {
       await setBrokenRecord();

       await getWaitingResult();

        setInterval(() => {
            setBrokenRecord();
        }, 10*60*1000);





    }

    async function setBrokenRecord() {
        const checkOldRecordWithoutReady = await MarketIDs.find({readyForScore: {$ne: true}, winnerInfo: null, runners: {$ne: null}, status: {$ne: 'OPEN'} });

        for (let index = 0; index < checkOldRecordWithoutReady.length; index++) {
            const element = checkOldRecordWithoutReady[index];
            await MarketIDs.updateOne({ _id: element._id }, { $set: { readyForScore: true } });
        }


        const results = await MarketIDs.aggregate([
            {
                $lookup: {
                    from: "inplayevents",         
                    localField: "eventId",   
                    foreignField: "Id",     
                    as: "eventData"          
                }
            },
            {
                $match: {
                    readyForScore: { $ne: true },
                    winnerInfo: null,
                    runners: { $ne: null },
                    sportID:{ $in: [1,2,4] },
                    status: 'OPEN',
                    "eventData.isShowed": true,
                    "eventData.status": { $ne: 'OPEN' }
                }
            },
            {
                $project: {
                    marketids: 1        
                }
            }
        ]);

        console.log(results);
        process.exit(1);
    }

    async function getWaitingResult() {
        try {
            const racingMarkets = await MarketIDs.find({readyForScore: true, sportID: {$in: [7, 4339]},winnerInfo: null }).sort({lastResultCheckTime: 1}).limit(1).exec();
            if (racingMarkets.length> 0)
            await apiRequest.getRacingResult(racingMarkets);
            const eventMarkets = await MarketIDs.find({readyForScore: true, sportID: {$in: [1, 2, 4]},winnerInfo: null }).sort({lastResultCheckTime: 1}).limit(10).exec();
            if (eventMarkets.length> 0)
            await apiRequest.getEventResult(eventMarkets);

        } catch (error) {
            console.log(error);
        }
        setTimeout(() => {
            getWaitingResult();
        }, 3000);
    }
}

