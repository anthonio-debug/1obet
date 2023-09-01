'use strict';

const { forEach } = require('lodash');

module.exports = ToolForRacing;

const sportsIds = [4339, 7];

const apiRequests = require('./api/apiRequestsRacing.js')();

const RaceOdds = require('../../app/models/raceOdds')


function ToolForRacing() {
    return { init };

    async function init(_io, express) {
        apiRequests.init(_io);
        setInterval(getRacing, 2*60 * 60 * 1000);
        getRacing();
        setInterval(apiRequests.checkOdds, 1 * 1000);
        setInterval(removeOdds,  60 * 1000);

    }

    function getRacing() {
        sportsIds.forEach(id => {
            apiRequests.racesTodayMeetings(id,'today');
            apiRequests.racesTodayMeetings(id,'tomorrow');
        });
    }

    function removeOdds () {
        const oneHourAgo = new Date().getTime() - 60 * 1000;
        RaceOdds.deleteMany({ createdAt: { $lt: oneHourAgo } }, (err) => {
          if (err) {
            console.error("Error while deleting from racing odds", err);
            return;
          }
          console.log("Documents older than 1 hour have been deleted.");
        });
    }
}