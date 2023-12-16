'use strict';
// const apiRequests = require('./api/apiRequestsRacing.js')();
var cron = require('node-cron');
const config = require("../../config/default.json")
const inPlayEvents = require('../../app/models/events');
const apiRequests = require('./api/apiRequestsUpdatedRacing.js')();

const sportsIds = [4339, 7];
const HORSE_RACE_SPORTS_ID = '7';

function ToolForUpdatedRacing() {
    return { init };

    async function init(_io, express) {
        apiRequests.init(_io);

        if (config.activeProvider == 'NEW') {
            setInterval(fetchMarkets, 10 * 1000);
            // setInterval(getRacing, 2 * 60 * 60 * 1000)
            // setInterval(apiRequests.checkOdds, 1 * 1000)
        }
    }

    async function fetchMarkets() {
        try {
            const documents = await inPlayEvents.findOne({ status: 'OPEN', sportsId: HORSE_RACE_SPORTS_ID })
                .sort({ lastCheckMarket: 1 })
                .limit(1)
                .exec();

            if (documents) {
                await apiRequests.listMarketsByCronJob(documents.Id, documents.sportsId, documents.competitionId);
                await inPlayEvents.updateMany(
                    { Id: documents.Id },
                    { $set: { lastCheckMarket: Date.now() } }
                );
                // fetchOddsForEvent(documents.Id);
            }
        } catch (error) {
            console.error('Error fetching markets:', error);
        }
    }

    function getRacing() {
        sportsIds.forEach(id => {
            apiRequests.racesTodayMeetings(id,'today');
            apiRequests.racesTodayMeetings(id,'tomorrow');
        });
    }
}

module.exports = ToolForUpdatedRacing;