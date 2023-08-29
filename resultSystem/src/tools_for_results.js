'use strict';
module.exports = ToolForResults;

const sportsIdsforRacing = ['4339', '7'];
const sportsIds = ['4', '2', '1'];
const Bets = require('../../app/models/bets');
const scoreChecker = require('./api/scoreChecker')();


function ToolForResults() {
    return { init };

    async function init() {


        setInterval(() => {
            getBetForEvents(sportsIds)
        }, 10 * 1000);


        setInterval(() => {
            getBetForEvents(sportsIdsforRacing)
        }, 10 * 1000);

        setInterval(() => {
            getBetForFancy()
        }, 30 * 1000);





    }


    async function getBetForEvents(targetArray) {
        const currentTime = new Date().getTime();
        try {
            const results = await Bets.aggregate([
                {
                    $match: {
                        sportsId: { $in: targetArray },
                        resultId: null,
                        marketId: { $ne: null },
                        isfancyOrbookmaker: false,
                        sportsId: { $ne: null },
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
                },
                {
                    $limit: 5 
                }
            ]).exec();
            for (const result of results) {
                await Bets.updateMany(
                    {
                        _id: { $in: result.documentIds },
                    },
                    {
                        $set: { lastCheckResult: currentTime }
                    }
                ).catch(e => console.error(e));
            }

            for (const result of results) {

                if (result.betDocument.length == 0)
                    continue;

                if (result.betDocument.sportsId == 1 || result.betDocument.sportsId == 2 || result.betDocument.sportsId == 4) {
                    scoreChecker.eventsResult(result.betDocument);
                } else if (result.betDocument.sportsId == 7 || result.betDocument.sportsId == 4339) {
                    scoreChecker.racingResult(result.betDocument);
                } else {
                    console.log('Undefined sports type ', result.betDocument);
                }

            }

        } catch (error) {
            console.error("Error:", error);
        }
    }

    async function getBetForFancy() {
        const currentTime = new Date().getTime();
        try {
            const results = await Bets.aggregate([
                {
                    $match: {
                        sportsId: '4',
                        resultId: null,
                        marketId: { $ne: null },
                        isfancyOrbookmaker: true

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
                },
                {
                    $limit: 1 
                }
            ]).exec();


            for (const result of results) {
                await Bets.updateMany(
                    {
                        _id: { $in: result.documentIds },
                    },
                    {
                        $set: { lastCheckResult: currentTime }
                    }
                ).catch(e => console.error(e));
            }

            for (const result of results) {

                if (result.betDocument.length == 0)
                    continue;

                if (result.betDocument.fancyData) {
                    scoreChecker.fancyResult(result.betDocument, result.betDocument.fancyData);
                } else {
                    scoreChecker.bookMakerResult(result.betDocument);
                }


            }

        } catch (error) {
            console.error("Error:", error);
        }
    }
}