'use strict';
module.exports = scoreChecker;

var mongoose = require('mongoose');
const axios = require('axios');


const horseRaceUrl = "http://136.244.77.249:33333";
const sportsAPIUrl = 'http://209.250.242.175:33332';


const resultRecords = require('../../../app/models/resultRecords');
const Bets = require('../../../app/models/bets');
const inPlayEvents = require('../../../app/models/events');
const {
    handleLosingBet,
    handleWinningBet,
    handleDrawBet
} = require('../CalculateBets/calculations')

function scoreChecker() {
    return { eventsResult, racingResult, fancyResult, bookMakerResult, manuel };


    async function eventsResult(betData) {
        console.log('Result checking event');
        var url = `${sportsAPIUrl}/results/?ids=${betData.marketId}`;
        try {
            const response = await axios.get(url);
            const results = response.data;
            if (results.length > 0) {
                const result = results[0];
                var newRecord = new resultRecords({
                    eventId: betData.matchId,
                    marketData: betData.marketId,
                    resultData: result.winnerSelectionId
                });

                const bets = await Bets.find({ marketId: betData.marketId, sportsId: betData.sportsId, status: 1 });

                await newRecord.save();
                await Bets.updateMany({ marketId: betData.marketId, sportsId: betData.sportsId }, { $set: { resultId: newRecord._id } });


                if (result.winnerSelectionId == -1) {
                    for (const bet of bets) {
                        await handleDrawBet(bet);
                    }
                } else {
                    for (const bet of bets) {
                        if (bet.type == 0 && bet.runner == result.winnerSelectionId) {
                            console.log("0 ----- winner ");
                            await handleWinningBet(bet);

                        } else if (bet.type == 0 && bet.runner != result.winnerSelectionId) {
                            console.log("0 ----- looser ");
                            await handleLosingBet(bet);

                        } else if (bet.type == 1 && bet.runner != result.winnerSelectionId) {
                            console.log("1 ----- winner ");
                            await handleWinningBet(bet);

                        } else if (bet.type == 1 && bet.runner == result.winnerSelectionId) {
                            console.log("1 ----- looser ");
                            await handleLosingBet(bet);

                        } else {
                            console.log("-----  Draw ");
                            await handleDrawBet(bet);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }

    }
    async function racingResult(betData) {
        console.log('Result checking racing');

        var url = `${horseRaceUrl}/results/?ids=${betData.marketId}`;
        try {
            const response = await axios.get(url);
            const results = response.data;
            if (results.length > 0) {
                const result = results[0];
                var newRecord = new resultRecords({
                    eventId: betData.matchId,
                    marketData: betData.marketId,
                    resultData: result.winnerSelectionId
                });

                const bets = await Bets.find({ marketId: betData.marketId, sportsId: betData.sportsId, status: 1 });

                await newRecord.save();
                await Bets.updateMany({ marketId: betData.marketId, sportsId: betData.sportsId }, { $set: { resultId: newRecord._id } });

                if (result.winnerSelectionId == -1) {
                    for (const bet of bets) {
                        await handleDrawBet(bet);
                    }
                } else {
                    for (const bet of bets) {
                        if (bet.type == 0 && bet.runner == result.winnerSelectionId) {
                            console.log("0 ----- winner ");
                            await handleWinningBet(bet);

                        } else if (bet.type == 0 && bet.runner != result.winnerSelectionId) {
                            console.log("0 ----- looser ");
                            await handleLosingBet(bet);

                        } else if (bet.type == 1 && bet.runner != result.winnerSelectionId) {
                            console.log("1 ----- winner ");
                            await handleWinningBet(bet);

                        } else if (bet.type == 1 && bet.runner == result.winnerSelectionId) {
                            console.log("1 ----- looser ");
                            await handleLosingBet(bet);

                        } else {
                            console.log("-----  Draw ");
                            await handleDrawBet(bet);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
    async function bookMakerResult(betData) {

        try {
            const event = await inPlayEvents.findOne({ _id: mongoose.Types.ObjectId(betData.matchId) }, { Id: 1 });

            if (!event)
                return;

            var url = ` https://betfairoddsapi.com:3443/api/bookmaker_result/${event.Id}`;

            const response = await axios.get(url);
            const results = response.data;
            if (results.length > 0) {
                const result = results[0];
                var newRecord = new resultRecords({
                    eventId: betData.matchId,
                    marketData: 'Bookmaker',
                    resultData: result
                });


                await newRecord.save();
                await Bets.updateMany({ matchId: event._id.toString(), isfancyOrbookmaker: true, fancyData: null }, { $set: { resultId: newRecord._id } });

                const bets = await Bets.find({ matchId: event._id.toString(), isfancyOrbookmaker: true, fancyData: null, status: 1 });

                if (result.winnerSelId == -1) {
                    for (const bet of bets) {
                        await handleDrawBet(bet);
                    }
                } else {
                    for (const bet of bets) {
                        if (bet.type == 0 && bet.runner == result.winnerSelId) {
                            console.log("0 ----- winner ");
                            await handleWinningBet(bet);

                        } else if (bet.type == 0 && bet.runner != result.winnerSelId) {
                            console.log("0 ----- looser ");
                            await handleLosingBet(bet);

                        } else if (bet.type == 1 && bet.runner != result.winnerSelId) {
                            console.log("1 ----- winner ");
                            await handleWinningBet(bet);

                        } else if (bet.type == 1 && bet.runner == result.winnerSelId) {
                            console.log("1 ----- looser ");
                            await handleLosingBet(bet);

                        } else {
                            console.log("-----  Draw ");
                            await handleDrawBet(bet);
                        }
                    }
                }




            }
        } catch (error) {
            console.error(error);
        }




    }
    async function fancyResult(betData, fancyName) {
        try {
            const event = await inPlayEvents.findOne({ _id: mongoose.Types.ObjectId(betData.matchId) }, { Id: 1 });

            if (!event)
                return;

            var url = ` https://betfairoddsapi.com:3443/api/fancy_result_multi/${event.Id}/${fancyName}`;

            const response = await axios.get(url);
            const results = response.data;
            if (results.length > 0) {
                const result = results[0];

                if (result.result == null)
                    return;

                var newRecord = new resultRecords({
                    eventId: betData.matchId,
                    marketData: fancyName,
                    resultData: result.result
                });

                await newRecord.save();
                await Bets.updateMany({ matchId: event._id.toString(), isfancyOrbookmaker: true, fancyData: { $ne: null } }, { $set: { resultId: newRecord._id } });


                const bets = await Bets.find({ matchId: event._id.toString(), isfancyOrbookmaker: true, fancyData: { $ne: null }, status: 1 });

                if (result.result == -1) {
                    for (const bet of bets) {
                        await handleDrawBet(bet);
                    }
                } else {
                    for (const bet of bets) {
                        if (bet.type == 0 && parseInt(bet.runner) >= parseInt(result.result)) {
                            console.log("0 ----- winner ");
                            await handleWinningBet(bet);

                        } else if (bet.type == 0 && parseInt(bet.runner) < parseInt(result.result)) {
                            console.log("0 ----- looser ");
                            await handleLosingBet(bet);

                        } else if (bet.type == 1 && parseInt(bet.runner) < parseInt(result.result)) {
                            console.log("1 ----- winner ");
                            await handleWinningBet(bet);

                        } else if (bet.type == 1 && parseInt(bet.runner) >= parseInt(result.result)) {
                            console.log("1 ----- looser ");
                            await handleLosingBet(bet);

                        } else {
                            console.log("-----  Draw ");
                            await handleDrawBet(bet);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    }


    async function manuel(bets) {


        for (let index = 0; index < bets.length; index++) {
            const bet = bets[index];
            if (bet.betData.type == 2) {
                var correctScore = bet.score % 10;
                if (bet.betData.TargetScore == correctScore) {
                    console.log("0 ----- winner ");
                    await handleWinningBet(bet.betData);
                } else {
                    console.log("0 ----- looser ");
                    await handleLosingBet(bet.betData);
                }
            }

            if (bet.betData.type == 3) {
                var correctScore = bet.score % 2;
                if (bet.betData.runnerName =='JOTTA' && correctScore == 0) {
                    console.log("0 ----- winner ");
                    await handleWinningBet(bet.betData);
                } else if (bet.betData.runnerName =='KALI' && correctScore == 1) {
                    console.log("0 ----- winner ");
                    await handleWinningBet(bet.betData);
                } else {
                    console.log("0 ----- looser ");
                    await handleLosingBet(bet.betData);
                }
            }

            if (bet.betData.type == 4) {
                var correctScore = bet.score % 10;
                if (bet.betData.runnerName =='BARA' && correctScore == 0) {
                    console.log("0 ----- winner ");
                    await handleWinningBet(bet.betData);
                } else if (bet.betData.runnerName =='CHOTA' && correctScore < 6) {
                    console.log("0 ----- winner ");
                    await handleWinningBet(bet.betData);
                }
                else if (bet.betData.runnerName =='BARA' && correctScore > 5) {
                    console.log("0 ----- winner ");
                    await handleWinningBet(bet.betData);
                }
                 else {
                    console.log("0 ----- looser ");
                    await handleLosingBet(bet.betData);
                }
            }

        }

    }


}