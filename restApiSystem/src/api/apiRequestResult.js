"use strict";
const axios = require("axios");
const _ = require("lodash");

const config = require("../../../config/default.json")
const MarketIDs = require("../../../app/models/marketIds");
const Events = require("../../../app/models/events");

const sportsAPIUrl = "http://185.58.225.212:8080/api";

const header = {
  headers: {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'X-App': 'testqms'
  },
}
let io;

function apiRequestResult() {
  return {
    init,
    getEventResult,
  };

  function init(_io, express) {
    io = _io;
  }

  async function getEventResult(markets) {
    const currentTime = new Date().getTime();
    let marketIdList = [];
    for (let index = 0; index < markets.length; index++) {
      marketIdList.push(markets[index].marketId);
      await MarketIDs.findOneAndUpdate({_id: markets[index]._id}, {lastResultCheckTime: currentTime})
    }

    const requestData = {
      "marketIds": marketIdList
    }

    const url = `${sportsAPIUrl}/listMarketBook`;
    axios.post(
      url,
      requestData,
      header
    )
      .then(
        async (response) => {
          const results = response.data.result;
          for (let index = 0; index < results.length; index++) {
            const result = results[index];
            const marketIndex = _.findIndex(markets, function (o) {
              return o.marketId == result.marketId;
            });
            if (marketIndex != -1) {
              if (result.winnerSelectionId == '-1') {
                await MarketIDs.findOneAndUpdate({_id: markets[marketIndex]._id}, {$set: {winnerInfo: 'Canceled'}});

                if (markets[marketIndex].marketName == 'Match Odds') {
                  await Events.findOneAndUpdate({Id: markets[marketIndex].eventId}, {$set: {winner: 'Canceled'}});
                }

                continue;
              }
              if (typeof markets[marketIndex].runners !== 'undefined') {
                const runnerIndex = _.findIndex(markets[marketIndex].runners, function (o) {
                  return o.SelectionId == result.winnerSelectionId;
                });
                if (runnerIndex != -1) {
                  await MarketIDs.findOneAndUpdate({_id: markets[marketIndex]._id}, {$set: {winnerInfo: markets[marketIndex].runners[runnerIndex].runnerName}});
                  if (markets[marketIndex].marketName == 'Match Odds') {
                    await Events.findOneAndUpdate({Id: markets[marketIndex].eventId}, {$set: {winner: markets[marketIndex].runners[runnerIndex].runnerName}});
                  }
                } else {
                  await MarketIDs.findOneAndUpdate({_id: markets[marketIndex]._id}, {$set: {winnerInfo: result.winnerSelectionId}});
                  if (markets[marketIndex].marketName == 'Match Odds') {
                    await Events.findOneAndUpdate({Id: markets[marketIndex].eventId}, {$set: {winner: result.winnerSelectionId}});
                  }
                }
              } else {
                await MarketIDs.findOneAndUpdate({_id: markets[marketIndex]._id}, {$set: {winnerInfo: result.winnerSelectionId}});
                if (markets[marketIndex].marketName == 'Match Odds') {
                  await Events.findOneAndUpdate({Id: markets[marketIndex].eventId}, {$set: {winner: result.winnerSelectionId}});
                }
              }

              await Events.findOneAndUpdate({Id: markets[marketIndex].eventId}, {$set: {isResultSaved: true}});

            } else {
              console.log('Record not found');
            }
          }
        }
      )
      .catch((error) => {
        console.log(error);
      });
  }

}

module.exports = apiRequestResult;
