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
            const racings = await MarketIDs.find({}).limit(10).exec();
            console.log(racings);
        } catch (error) {
            console.log(error);
        }
    }
}

