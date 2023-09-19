'use strict';
module.exports = scoreChecker;

var mongoose = require('mongoose');
const axios = require('axios');


const horseRaceUrl = "http://136.244.77.249:33333";
const sportsAPIUrl = 'http://209.250.242.175:33332';


const resultRecords = require('../../../app/models/resultRecords');
const Bets = require('../../../app/models/bets');
const inPlayEvents = require('../../../app/models/events');
const MarketIDs = require('../../../app/models/marketIds');


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
            var results;
            const manuelRecord = await MarketIDs.findOne({ marketId: betData.marketId, winnerRunnerData: { $ne: null } });

            if (manuelRecord) {
                if (typeof manuelRecord.manuelClose !== undefined)
                    results = [{ winnerSelectionId: manuelRecord.winnerRunnerData, manuelClose: manuelRecord.manuelClose }];
                else
                    results = [{ winnerSelectionId: manuelRecord.winnerRunnerData, manuelClose: false }];
            } else {
                const response = await axios.get(url);
                results = response.data;
            }

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
                        if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
                            continue;
                        }

                        await handleDrawBet(bet);
                    }
                } else {
                    for (const bet of bets) {
                        if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
                            continue;
                        }
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
            var results;
            const manuelRecord = await MarketIDs.findOne({ marketId: betData.marketId, winnerRunnerData: { $ne: null } });

            if (manuelRecord) {
                if (typeof manuelRecord.manuelClose !== undefined)
                    results = [{ winnerSelectionId: manuelRecord.winnerRunnerData, manuelClose: manuelRecord.manuelClose }];
                else
                    results = [{ winnerSelectionId: manuelRecord.winnerRunnerData, manuelClose: false }];
            } else {
                const response = await axios.get(url);
                results = response.data;
            }
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
                        if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
                            continue;
                        }
                        console.log('handle bet draw');
                        await handleDrawBet(bet);
                    }
                } else {
                    for (const bet of bets) {
                        if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
                            continue;
                        }
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


            var results
            const manuelRecord = await MarketIDs.findOne({ marketId: 'Bookmaker', eventId: event.Id, winnerRunnerData: { $ne: null } });

            if (manuelRecord) {
                if (typeof manuelRecord.manuelClose !== undefined)
                    results = [{ winnerSelId: manuelRecord.winnerRunnerData, manuelClose: manuelRecord.manuelClose }];
                else
                    results = [{ winnerSelId: manuelRecord.winnerRunnerData, manuelClose: false }];
            } else {
                var url = ` https://betfairoddsapi.com:3443/api/bookmaker_result/${event.Id}`;
                const response = await axios.get(url);
                results = response.data;
            }


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


                await MarketIDs.findOneAndUpdate(
                    {
                        eventId: event.Id,
                        marketId: 'Bookmaker',
                    },
                    {
                        eventId: event.Id,
                        marketId: 'Bookmaker',
                        marketName: result.eventName,
                        sportID: -1,
                        status: 'Bookmaker Result',
                        winnerInfo: result.winnerSelId,
                        winnerRunnerData: result.winnerSelId,
                        index: 0
                    },
                    {
                        new: true,
                        upsert: true
                    }
                );


                if (result.winnerSelId == -1) {
                    for (const bet of bets) {
                        if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
                            continue;
                        }
                        await handleDrawBet(bet);
                    }
                } else {
                    for (const bet of bets) {
                        if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
                            continue;
                        }
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

            var results
            const manuelRecord = await MarketIDs.findOne({ marketId: fancyName, eventId: event.Id, winnerRunnerData: { $ne: null } });

            if (manuelRecord) {
                if (typeof manuelRecord.manuelClose !== undefined)
                    results = [{ result: manuelRecord.winnerRunnerData, manuelClose: manuelRecord.manuelClose }];
                else
                    results = [{ result: manuelRecord.winnerRunnerData, manuelClose: false }];
            } else {
                var url = ` https://betfairoddsapi.com:3443/api/fancy_result_multi/${event.Id}/${fancyName}`;
                const response = await axios.get(url);
                results = response.data;
            }



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


                await MarketIDs.findOneAndUpdate(
                    {
                        eventId: event.Id,
                        marketId: fancyName,
                    },
                    {
                        eventId: event.Id,
                        marketId: fancyName,
                        marketName: result.fancyName,
                        sportID: -1,
                        status: 'Fancy Result',
                        winnerInfo: result.result,
                        winnerRunnerData: result.result,

                        index: 0
                    },
                    {
                        new: true,
                        upsert: true
                    }
                );



                if (result.result == -1) {
                    for (const bet of bets) {
                        if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
                            continue;
                        }
                        await handleDrawBet(bet);
                    }
                } else {
                    for (const bet of bets) {
                        if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
                            continue;
                        }
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
            //figure bets

            const event = await inPlayEvents.findOne({ _id: mongoose.Types.ObjectId(bet.betData.matchId) }, { Id: 1 });


            if (bet.betData.type == 2) {
                var correctScore;
                if (bet.score == -1) {
                    await handleDrawBet(bet.betData);
                    correctScore = -1;
                } else {
                    correctScore = bet.score % 10;
                    if (bet.betData.runner == correctScore) {
                        console.log("0 ----- winner ");
                        await handleWinningBet(bet.betData);
                    } else {
                        console.log("0 ----- looser ");
                        await handleLosingBet(bet.betData);
                    }
                }



                if (event) {
                    await MarketIDs.findOneAndUpdate(
                        {
                            eventId: event.Id,
                            marketId: 'Session ' + bet.betData.betSession + ' Betting Figures',
                        },
                        {
                            eventId: event.Id,
                            marketId: 'Session ' + bet.betData.betSession + ' Betting Figures',
                            marketName: 'Session ' + bet.betData.betSession + ' Betting Figures',
                            sportID: -1,
                            status: 'Session Result',
                            winnerInfo: correctScore,
                            index: 0
                        },
                        {
                            new: true,
                            upsert: true
                        }
                    );
                }



            }

            //jotta kali
            if (bet.betData.type == 3) {
                var correctScore;
                if (bet.score == -1) {
                    await handleDrawBet(bet.betData);
                    correctScore = -1;

                } else {

                    correctScore = bet.score % 2;
                    if (bet.betData.runnerName == 'JOTTA' && correctScore == 0) {
                        console.log("0 ----- winner ");
                        await handleWinningBet(bet.betData);
                    } else if (bet.betData.runnerName == 'KALI' && correctScore == 1) {
                        console.log("0 ----- winner ");
                        await handleWinningBet(bet.betData);
                    } else {
                        console.log("0 ----- looser ");
                        await handleLosingBet(bet.betData);
                    }
                }



                if (event) {
                    await MarketIDs.findOneAndUpdate(
                        {
                            eventId: event.Id,
                            marketId: 'Session ' + bet.betData.betSession + ' JOTTA KALI',
                        },
                        {
                            eventId: event.Id,
                            marketId: 'Session ' + bet.betData.betSession + ' JOTTA KALI',
                            marketName: 'Session ' + bet.betData.betSession + ' JOTTA KALI',
                            sportID: -1,
                            status: 'Session Result',
                            winnerInfo: correctScore,
                            index: 0
                        },
                        {
                            new: true,
                            upsert: true
                        }
                    );
                }


            }
            /// Chota bara
            if (bet.betData.type == 4) {
                var correctScore;
                if (bet.score == -1) {
                    await handleDrawBet(bet.betData);
                    correctScore = -1;
                } else {
                    correctScore = bet.score % 10;
                    if (bet.betData.runnerName == 'BARA' && correctScore == 0) {
                        console.log("0 ----- winner ");
                        await handleWinningBet(bet.betData);
                    } else if (bet.betData.runnerName == 'CHOTA' && correctScore < 6) {
                        console.log("0 ----- winner ");
                        await handleWinningBet(bet.betData);
                    }
                    else if (bet.betData.runnerName == 'BARA' && correctScore > 5) {
                        console.log("0 ----- winner ");
                        await handleWinningBet(bet.betData);
                    }
                    else {
                        console.log("0 ----- looser ");
                        await handleLosingBet(bet.betData);
                    }
                }




                await MarketIDs.findOneAndUpdate(
                    {
                        eventId: event.Id,
                        marketId: 'Session ' + bet.betData.betSession + ' CHOTA BARA',
                    },
                    {
                        eventId: event.Id,
                        marketId: 'Session ' + bet.betData.betSession + ' CHOTA BARA',
                        marketName: 'Session ' + bet.betData.betSession + ' CHOTA BARA',
                        sportID: -1,
                        status: 'Session Result',
                        winnerInfo: correctScore,
                        index: 0
                    },
                    {
                        new: true,
                        upsert: true
                    }
                );

            }

        }

    }


}