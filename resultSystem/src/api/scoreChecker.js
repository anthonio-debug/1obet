'use strict';
module.exports = scoreChecker;
require('dotenv').config();

const axios = require('axios');
const mongoose = require('mongoose');
const resultRecords = require('../../../app/models/resultRecords');
const User = require('../../../app/models/user');
const Bets = require('../../../app/models/bets');
const inPlayEvents = require('../../../app/models/events');
const MarketIDs = require('../../../app/models/marketIds');
const FancyOdds = require('../../../app/models/fancyOdds');

const { API_DOMAIN } = require('../../../app/global/constants');
const { getAmountOfWinnerTemp, getAmountOfWinnerTempUpdated, getAmountOfWinnerFigures } = require('../CalculateBets/helper');
const { getSessionFancyResult, getSessionBookmakerResult } = require('../../../helper/api/sessionAPIHelper');



const { handleLosingBet, handleWinningBet, handleDrawBet, handleWinningBetXX, handleLosingBetX, handleWinningBetX, handleDrawBetX } = require('../CalculateBets/calculations');

const horseRaceUrl = 'http://136.244.77.249:33333';
// const sportsAPIUrl = "http://209.250.242.175:33332";
const sportsAPIUrl = 'http://185.58.225.212:8080/api';

const header = {
  headers: {
    accept: 'application/json',
    'Content-Type': 'application/json',
    'X-App': process.env.XAPP_NAME
  }
};

const tableInfo = [
  { id: '36', tId: 'teen20' },
  // { id: "37", tId: "teen9" },
  // { id: "38", tId: "lucky7" },
  { id: '39', tId: 'lucky7eu' },
  { id: '40', tId: 'card32eu' },
  { id: '41', tId: 'aaa' }
  // { id: "42", tId: "ab20" },
  // { id: "43", tId: "abj" },
  // { id: "44", tId: "worli" },
];

function scoreChecker() {
  return {
    eventsResult,
    racingResult,
    fancyResult,
    bookMakerResult,
  
    manuel
  };

  function getWinnerSelectionId(listMarketBookResult) {
    if (!listMarketBookResult) return null;
    let winnerSelectionId = null;
    const runners = listMarketBookResult.runners || [];
    for (const runner of runners) {
      if (runner.status === 'WINNER') {
        winnerSelectionId = runner.selectionId;
        break;
      }
    }
    return winnerSelectionId;
  }

  async function eventsResult(betData) {
    //console.log("Result checking event for ", betData.marketId);
    try {
      let results;
      const manuelRecord = await MarketIDs.findOne({
        marketId: betData.marketId,
        winnerRunnerData: { $ne: null }
      });

      if (manuelRecord) {



        if (typeof manuelRecord.manuelClose !== undefined) {
          results = [
            {
              winnerSelectionId: manuelRecord.winnerRunnerData,
              manuelClose: manuelRecord.manuelClose
            }
          ];
        } else {
          results = [
            {
              winnerSelectionId: manuelRecord.winnerRunnerData,
              manuelClose: false
            }
          ];
        }
      } 

      if (results.length > 0) {
        const result = results[0];
        if (!result.winnerSelectionId) return;
        let newRecord = new resultRecords({
          eventId: betData.matchId,
          marketData: betData.marketId,
          resultData: result.winnerSelectionId
        });

        const bets = await Bets.find({
          marketId: betData.marketId,
          sportsId: betData.sportsId,
          eventId: betData.eventId,
          betSession: betData.betSession,
          status: 1,
          calculateExp: true,
        });
    
       

        await newRecord.save();
        //Sports Results Saved
        //update inplayevents where betData.matchId if this market is match odds for soccer,tennis,cricket
        await Bets.updateMany({ marketId: betData.marketId, sportsId: betData.sportsId }, { $set: { resultId: newRecord._id } });

        if (result.winnerSelectionId == -1) {

          //console.log("result.winnerSelectionId == -1 -->", betData.marketId);
          for (const bet of bets) {


            if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true && result.winnerSelectionId >= 0) continue;

            const newBetUser = await User.findOne(
              { userId: bet.userId }
            );
            console.log("newBetUser.createdBy>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", newBetUser.createdBy);

            let winningsCalculate = await getAmountOfWinnerTemp(bet, result.winnerSelectionId,0);
            //HERE I WILL GIVE YOU CANCEL FUNCTION TO CALL ALL BETS OF THE MARKET...



            return;
          }
        } else {
          //console.log("ELSE result.winnerSelectionId == -1 -->", betData.marketId);
          for (const bet of bets) {

            if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true && result.winnerSelectionId >= 0) continue;
            const newBetUser = await User.findOne(
              { userId: bet.userId }
            );
            console.log("newBetUser.createdBy>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", newBetUser.createdBy);
            let winningsCalculate = await getAmountOfWinnerTemp(bet, result.winnerSelectionId,0);
            
            return;

          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function racingResult(betData) {


    try {
      let results;
      const manuelRecord = await MarketIDs.findOne({
        marketId: betData.marketId,
        winnerRunnerData: { $ne: null }
      });

      if (manuelRecord) {

        if (typeof manuelRecord.manuelClose !== undefined)
          results = [
            {
              winnerSelectionId: manuelRecord.winnerRunnerData,
              manuelClose: manuelRecord.manuelClose
            }
          ];
        else
          results = [
            {
              winnerSelectionId: manuelRecord.winnerRunnerData,
              manuelClose: false
            }
          ];
      } 



      const bets = await Bets.find({
        //userId: { $in: [23331,23332,23350] },
        marketId: betData.marketId,
        eventId: betData.eventId,
        betSession: betData.betSession,
        sportsId: betData.sportsId,
        calculateExp: true,
        status: 1

      });

      for (const bet of bets) {




        const newBetUser = await User.findOne(
          { userId: bet.userId }
        );
        console.log("newBetUser.createdBy>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", newBetUser.createdBy);

        await getAmountOfWinnerTemp(bet, bet.resultData,0);


      }


      /*
      code ends for custom saving
      */







      if (results.length > 0) {
        const result = results[0];
        if (!result.winnerSelectionId) return;
        let newRecord = new resultRecords({
          eventId: betData.matchId,
          marketData: betData.marketId,
          resultData: result.winnerSelectionId
        });


        const bets = await Bets.find({
          marketId: betData.marketId,
          eventId: betData.eventId,
          betSession: betData.betSession,
          sportsId: betData.sportsId,
          calculateExp: true,
          status: 1

        });


        await newRecord.save();





        await Bets.updateMany({ marketId: betData.marketId, sportsId: betData.sportsId }, { $set: { resultId: newRecord._id } });


        //console.log("result.winnerSelectionId------------------------------------------------------",result.winnerSelectionId);


        //return;

        if (result.winnerSelectionId == -1) {
          for (const bet of bets) {



            if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true && result.winnerSelectionId >= 0) continue;
            for (const bet of bets) {
              const newBetUser = await User.findOne(
                { userId: bet.userId }
              );
              console.log("newBetUser.createdBy>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", newBetUser.createdBy);

              let winningsCalculate = await getAmountOfWinnerTemp(bet, result.winnerSelectionId,0);
              //HERE I WILL GIVE YOU CANCEL FUNCTION TO CALL ALL BETS OF THE MARKET...

            }
            //console.log("handle bet draw");
            //await handleDrawBet(bet);
          }
        } else {
          for (const bet of bets) {

            if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
              //console.log("Inside manual 1111111111..........");
              continue;
              
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true && result.winnerSelectionId >= 0) continue;

            // console.log("Second------------------------------------------------------",bet.userId, "-------------", bet.marketId);
           
             await getAmountOfWinnerTemp(bet, result.winnerSelectionId,0);
            return;

          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function bookMakerResult(betData) {
    try {
      let selectedMarketId = null;
      const event = await inPlayEvents.findOne({ _id: mongoose.Types.ObjectId(betData.matchId) }, { Id: 1 });
      console.log("111....................... ");
      if (!event) return;
      console.log("2222....................... ");

      let results;
      const manuelRecord = await MarketIDs.findOne({
        marketId: betData.marketId,
        eventId: event.Id,
        winnerRunnerData: { $ne: null }
      });
      console.log("manuelRecord....................... for bookmaker", manuelRecord);
      if (manuelRecord) {
        if (typeof manuelRecord.manuelClose !== undefined)
          results = [
            {
              winnerSelId: manuelRecord.winnerRunnerData,
              manuelClose: manuelRecord.manuelClose
            }
          ];
        else results = [{ winnerSelId: manuelRecord.winnerRunnerData, manuelClose: false }];
      } 

      if (results.length > 0) {
        const result = results[0];
        let newRecord = new resultRecords({
          eventId: betData.matchId,
          marketData: selectedMarketId || 'Bookmaker',
          resultData: result
        });

        await newRecord.save();
        await Bets.updateMany(
          {
            matchId: event._id.toString(),
            isfancyOrbookmaker: true,
            fancyData: null
          },
          { $set: { resultId: newRecord._id } }
        );

        const bets = await Bets.find({
          matchId: event._id.toString(),
          isfancyOrbookmaker: true,
          fancyData: null,
          calculateExp: true,
          status: 1
        });

        await MarketIDs.findOneAndUpdate(
          {
            eventId: event.Id,
            marketId: selectedMarketId || 'Bookmaker'
          },
          {
            eventId: event.Id,
            marketId: selectedMarketId || 'Bookmaker',
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
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true && result.winnerSelectionId >= 0) continue;
            const newBetUser = await User.findOne(
              { userId: bet.userId }
            );
            console.log("newBetUser.createdBy>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", newBetUser.createdBy);


            let winningsCalculate = await getAmountOfWinnerTemp(bet, result.winnerSelId,0);



            return;
          }
        } else {
          for (const bet of bets) {
            if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true && result.winnerSelectionId >= 0) continue;
            const newBetUser = await User.findOne(
              { userId: bet.userId }
            );
            console.log("newBetUser.createdBy>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", newBetUser.createdBy);

            let winningsCalculate = await getAmountOfWinnerTemp(bet, result.winnerSelId,0);


            return;


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
      console.log("event-11--------------------------------------------", event);
      if (!event) return;
      console.log("event---------------------------------------------", event);
      let results;
      console.log("fancyName================>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", fancyName);
      const manuelRecord = await MarketIDs.findOne({
        marketId: fancyName,
        eventId: event.Id,
        winnerRunnerData: { $ne: null }
      });
      //console.log("manuelRecord--------------------------",manuelRecord);
      if (manuelRecord) {
        //console.log("manuelRecord for fancies.............................................................",);
        if (typeof manuelRecord.manuelClose !== undefined)
          results = [
            {
              result: manuelRecord.winnerRunnerData,
              manuelClose: manuelRecord.manuelClose
            }
          ];
        else results = [{ result: manuelRecord.winnerRunnerData, manuelClose: false }];
      } else {
        //console.log("Auto.......... for fancies.............................................................",);
        results = [];


      }

      if (results.length > 0) {
        const result = results[0];

        if (result.result == null) return;

        let FindInMe = result.result;
        let findMe = FindInMe.search("Adv");



        //console.log("RE...........................................ult>>>", result);


        let newRecord = new resultRecords({
          eventId: betData.matchId,
          marketData: fancyName,
          resultData: result.result
        });

        await newRecord.save();
        await Bets.updateMany(
          {
            matchId: event._id.toString(),
            isfancyOrbookmaker: true,
            fancyData: fancyName
          },
          {
            $set: {
              resultId: newRecord._id,
              resultData: result.result
            }
          }
        );
        console.log("fancyName is going to proces...............................................", fancyName);
        const bets = await Bets.find({
          matchId: event._id.toString(),
          isfancyOrbookmaker: true,
          fancyData: fancyName,
          calculateExp: true,
          status: 1
        });
        //console.log("bets------------------------------------------------------------",bets);
        await MarketIDs.findOneAndUpdate(
          {
            eventId: event.Id,
            marketId: fancyName
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
          console.log(bet);
          console.log("if (result.result == -1) {");

          console.log("if (result.result == -1) {");
          console.log("if (result.result == -1) {");
          console.log("if (result.result == -1) {");
          console.log("if (result.result == -1) {");
          console.log("if (result.result == -1) {");
          console.log("if (result.result == -1) {");
          console.log("if (result.result == -1) {");
          console.log("if (result.result == -1) {");
          console.log("if (result.result == -1) {");
          console.log("if (result.result == -1) {");

          console.log("if (result.result == -1) {");
          //console.log("result.winnerSelectionId-====================================================............",result.winnerSelectionId);
          for (const bet of bets) {



            if (typeof bet.isManuel !== 'undefined' && bet.isManuel === true && result.manuelClose === false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel === true) continue;
            //await handleDrawBetX(bet);
            await handleWinningBetXX(bet, 0);
            //HERE I WILL GIVE YOU CANCEL FUNCTION TO CALL ALL BETS OF THE MARKET...
            
          }
        } else {
          for (const bet of bets) {

            if (typeof bet.isManuel !== 'undefined' && bet.isManuel === true && result.manuelClose === false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel === true) continue;

            //check type
            //for type 0
           
            await handleWinningBetXX(bet, 0);



          }
        }
      }
    } catch (error) {
      console.error('fancyResult:', error);
    }
  }

  

  async function manuel(bets) {
    for (let bet of bets) {
      // const checkActive = await checkActiveBettors(bet.betData);
      // if (checkActive) continue;
     

      const event = await inPlayEvents.findOne({ _id: mongoose.Types.ObjectId(bet.betData.matchId) }, { Id: 1 });

      if (bet.betData.type == 2) {
         //figure bets
        var correctScore;

        if (bet.score == -1) {
          correctScore = bet.score;
        } else {
          correctScore = bet.score % 10;
        }
        console.log("--", bet.betData.userId, "--", bet.betData._id, "----figures------------>>>>", correctScore);

        await getAmountOfWinnerFigures(bet.betData, correctScore,0);


        if (event) {
          await MarketIDs.findOneAndUpdate(
            {
              eventId: event.Id,
              marketId: 'Session ' + bet.betData.betSession + ' Betting Figures'
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

      
      if (bet.betData.type === 3) {
        //jotta kali
        var correctScore;

        if (bet.score == -1) {
          correctScore = bet.score;
        } else {

          correctScore = bet.score % 2;
          // console.log("================================",correctScore);
        }

        //console.log("--",bet.score,"--",bet.betData._id,"------before--KALLI,JOTTA------------>>>>",correctScore);
        if (correctScore == 1) {
          correctScore = 0
        } else {
          correctScore = 1
        }

         await getAmountOfWinnerFigures(bet.betData, correctScore,0);

        if (event) {
          await MarketIDs.findOneAndUpdate(
            {
              eventId: event.Id,
              marketId: 'Session ' + bet.betData.betSession + ' JOTTA KALI'
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
      
      if (bet.betData.type === 4) {
        /// Chota bara
        var correctScore;
        let selectionId = 1;
        console.log("bet.score 1=================", bet.score);
        console.log("selectionId 1=================", selectionId);
        if (bet.score == -1) {
          correctScore = bet.score;
        } else {
          correctScore = bet.score % 10;
        }
        console.log("correctScore=================", correctScore);
        console.log("selectionId 2=================", selectionId);
        if (correctScore < 6 && correctScore > 0) {
          selectionId = 0;
        }

        console.log("selectionId 3=================", selectionId);

        await getAmountOfWinnerFigures(bet.betData, selectionId,0);

        await MarketIDs.findOneAndUpdate(
          {
            eventId: event.Id,
            marketId: 'Session ' + bet.betData.betSession + ' CHOTA BARA'
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
