'use strict';

const { forEach } = require('lodash');

module.exports = ToolForRacing;

const sportsIds = [4339, 7];

const apiRequests = require('./api/apiRequestsRacing.js')();
var cron = require('node-cron');


function ToolForRacing() {
    return { init };

    async function init(_io, express) {
        apiRequests.init(_io);
        let intervalIds = [];
        
        function startIntervals() {
            intervalIds.push(setInterval(getRacing, 2 * 60 * 60 * 1000))
            intervalIds.push(setInterval(apiRequests.checkOdds, 1 * 1000))
        }
        
        setTimeout(() => {
            // Clear the interval with ID intervalIds[0]
            for(const intervalId of intervalIds) {
                clearInterval(intervalId);
            }

            intervalIds = [];
            
            startIntervals();

            console.log("Interval 0 cleared after 30 seconds");
        }, 2 * 60 * 60 * 1000);

        getRacing();

        cron.schedule('30 21 * * *', () => {
            getRacing();
        },{timezone: "America/New_York"});

    }

    function getRacing() {
        sportsIds.forEach(id => {
            apiRequests.racesTodayMeetings(id,'today');
            apiRequests.racesTodayMeetings(id,'tomorrow');
        });
    }


}