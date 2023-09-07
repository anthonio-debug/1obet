'use strict';
module.exports = toolStart;
const apiRequest = require('./apiRequest')();
const MarketIDs = require('../app/models/marketIds');

function toolStart() {
    return { init };

    async function init() {
        getWaitingResult();
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

