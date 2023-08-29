'use strict';
module.exports = scoreChecker;

var mongoose = require('mongoose');
const axios = require('axios');


const horseRaceUrl = "http://136.244.77.249:33333";
const sportsAPIUrl = 'http://209.250.242.175:33332';


const resultRecords = require('../../../app/models/resultRecords');
const Bets = require('../../../app/models/bets');
const inPlayEvents = require('../../../app/models/events');


function scoreChecker() {
    return { eventsResult, racingResult, fancyResult, bookMakerResult };


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

                if (result.winnerSelectionId == -1) {
                    console.log("This event Canceled ");
                } else {
                    for (const bet of bets) {
                        if (bet.type == 0 && bet.runner == result.winnerSelectionId) {
                            console.log("0 ----- winner ");
                            //await handleWinningBet(bet);
    
                        } else if (bet.type == 0 && bet.runner != result.winnerSelectionId) {
                            console.log("0 ----- looser ");
                            //await handleLosingBet(bet);
    
                        } else if (bet.type == 1 && bet.runner != result.winnerSelectionId) {
                            console.log("1 ----- winner ");
                            //await handleWinningBet(bet);
    
                        } else if (bet.type == 1 && bet.runner == result.winnerSelectionId) {
                            console.log("1 ----- looser ");
                            //await handleLosingBet(bet);
    
                        } else {
                            console.log("-----  Draw ");
                            //await handleDrawBet(bet);
                        }
                    }
                }

                //await newRecord.save();
                //await Bets.findOneAndUpdate({ _id: betData._id }, {betData: newRecord._id});
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

                if (result.winnerSelectionId == -1) {
                    console.log("This event Canceled ");
                } else {
                    for (const bet of bets) {
                        if (bet.type == 0 && bet.runner == result.winnerSelectionId) {
                            console.log("0 ----- winner ");
                            //await handleWinningBet(bet);
    
                        } else if (bet.type == 0 && bet.runner != result.winnerSelectionId) {
                            console.log("0 ----- looser ");
                            //await handleLosingBet(bet);
    
                        } else if (bet.type == 1 && bet.runner != result.winnerSelectionId) {
                            console.log("1 ----- winner ");
                            //await handleWinningBet(bet);
    
                        } else if (bet.type == 1 && bet.runner == result.winnerSelectionId) {
                            console.log("1 ----- looser ");
                            //await handleLosingBet(bet);
    
                        } else {
                            console.log("-----  Draw ");
                            //await handleDrawBet(bet);
                        }
                    }
                }


                //await newRecord.save();
                //await Bets.findOneAndUpdate({ _id: betData._id }, {betData: newRecord._id});
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



                const bets = await Bets.find({ matchId: event._id.toString(), isfancyOrbookmaker: true, fancyData: null, status: 1 });

                if (result.winnerSelId == -1) {
                    console.log("This event Canceled ");
                } else {
                    for (const bet of bets) {
                        if (bet.type == 0 && bet.runner == result.winnerSelId) {
                            console.log("0 ----- winner ");
                            //await handleWinningBet(bet);
    
                        } else if (bet.type == 0 && bet.runner != result.winnerSelId) {
                            console.log("0 ----- looser ");
                            //await handleLosingBet(bet);
    
                        } else if (bet.type == 1 && bet.runner != result.winnerSelId) {
                            console.log("1 ----- winner ");
                            //await handleWinningBet(bet);
    
                        } else if (bet.type == 1 && bet.runner == result.winnerSelId) {
                            console.log("1 ----- looser ");
                            //await handleLosingBet(bet);
    
                        } else {
                            console.log("-----  Draw ");
                            //await handleDrawBet(bet);
                        }
                    }
                }



                //await newRecord.save();
                //await Bets.findOneAndUpdate({ _id: betData._id }, { betData: newRecord._id });
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


                const bets = await Bets.find({ matchId: event._id.toString(), isfancyOrbookmaker: true, fancyData: { $ne: null }, status: 1 });

                if (result.winnerSelId == -1) {
                    console.log("This event Canceled ");
                } else {
                    for (const bet of bets) {
                        if (bet.type == 0 && parseInt(bet.runner) >=  parseInt(result.result)) {
                            console.log("0 ----- winner ");
                            //await handleWinningBet(bet);
    
                        } else if (bet.type == 0 && parseInt(bet.runner) < parseInt(result.result)) {
                            console.log("0 ----- looser ");
                            //await handleLosingBet(bet);
    
                        } else if (bet.type == 1 &&  parseInt(bet.runner) < parseInt(result.result)) {
                            console.log("1 ----- winner ");
                            //await handleWinningBet(bet);
    
                        } else if (bet.type == 1 && parseInt(bet.runner) >=  parseInt(result.result)) {
                            console.log("1 ----- looser ");
                            //await handleLosingBet(bet);
    
                        } else {
                            console.log("-----  Draw ");
                            //await handleDrawBet(bet);
                        }
                    }
                }



                //await newRecord.save();
                //await Bets.findOneAndUpdate({ _id: betData._id }, { betData: newRecord._id });
            }
        } catch (error) {
            console.error(error);
        }
    }



}