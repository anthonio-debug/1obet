'use strict';
module.exports = ToolForResults;

const sportsIdsforRacing = ['4339', '7'];
const sportsIds = ['4', '2', '1'];
const Bets = require('../../app/models/bets');


function ToolForResults() {
    return { init };

    async function init(_io, express) {
        setInterval(checkResult, 1 * 1000);
    }

    function checkResult() {
        getBetForEvents(sportsIds);
        getBetForEvents(sportsIdsforRacing);
        getBetForFancy();

    }

    async function getBetForEvents(targetArray) {
        const currentTime = new Date().getTime();
        try {
            const results = await Bets.aggregate([
                {
                    $match: {
                        sportsId: { $in: targetArray },
                        resultId: null
                    }
                },
                {
                    $group: {
                        _id: '$marketId',
                        betDocument: { $first: "$$ROOT" } 
                    }
                },
                {
                    $sort: {
                        lastCheckResults: 1
                    }
                }
            ]).exec();


            for (const result of results) {
                // Grouped by marketId, now we update each corresponding document
                await Bets.updateMany(
                    {
                        _id: { $in: result.documentIds },
                    },
                    {
                        $set: { lastCheckResult: currentTime }
                    }
                ).catch(e => console.error(e));
            }
            console.log(results);
            process.exit(1);

            console.log(result);
        } catch (error) {
            console.error("Hata:", error);
        }
    }

    async function getBetForFancy() {

    }
}