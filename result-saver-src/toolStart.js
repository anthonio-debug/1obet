'use strict';
module.exports = toolStart;
const MarketIDs = require('../../one-o-bet-backend/app/models/marketIds');

function toolStart() {
    return { init };

    async function init() {
        getWaitingResult();
    }

    async function getWaitingResult() {
        console.log('getWaitingResult for Racings and events');
        try {
            const racingMarkets = await MarketIDs.find({readyForScore: true, sportID: {$in: [7, 4339]},winnerInfo: null }).limit(20).exec();
            console.log(racingMarkets);
            const eventMarkets = await MarketIDs.find({readyForScore: true, sportID: {$nin: [7, 4339]},winnerInfo: null }).limit(20).exec();
            console.log(eventMarkets);
        } catch (error) {
            console.log(error);
        }
    }
}

