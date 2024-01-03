'use strict';
// const apiRequests = require('./api/apiRequestsRacing.js')();
var cron = require('node-cron');
const config = require("../../config/default.json")
const inPlayEvents = require('../../app/models/events');
const apiRequests = require('./api/apiRequestsUpdatedRacing.js')();

const sportsIds = ['4339', '7'];
// const sportsIds = ['4339'];
const HORSE_RACE_SPORTS_ID = '7';
const GREY_HOUND_ID = '4339'

function ToolForUpdatedRacing() {
    return { init };

    async function init(_io, express) {
        apiRequests.init(_io);

        if (config.activeProvider == 'NEW') {
            setInterval(getRacing, 10 * 1000)
            setInterval(() => fetchMarkets(), 10 * 1000);
            // setTimeout(() => {
            //     setInterval(apiRequests.checkOdds, 2 * 1000);
            // }, 1000 * 60); // Delayed by 1 second
        }
    }

    async function fetchMarkets() {
        try {
            sportsIds.forEach(async id => {
                const documents = await inPlayEvents.find({ status: 'OPEN', sportsId: id })
                    .sort({ lastCheckMarket: 1 })
                    .limit(config.raceEventsAllowedCount)
                    .exec();

                for (let i = 0; i < documents?.length; i ++) {
                    if (documents[i]) {
                        await apiRequests.listMarketsByCronJob(documents[i].Id, documents[i].sportsId, documents[i].competitionId);
                        await inPlayEvents.updateMany(
                            { Id: documents.Id },
                            { $set: { lastCheckMarket: Date.now() } }
                        );
                        // fetchOddsForEvent(documents.Id);           
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching markets:', error);
        }
    }

    function getRacing() {
        sportsIds.forEach(id => {
            apiRequests.eventsBySupportJobs(id);
        });
    }
}

module.exports = ToolForUpdatedRacing;