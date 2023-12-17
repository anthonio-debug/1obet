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
    for (const market of markets) {
      marketIdList.push(market.marketId);
      await MarketIDs.findOneAndUpdate({_id: market._id}, {lastResultCheckTime: currentTime})
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
          for (const result of results) {
            const marketIndex = _.findIndex(markets, (o) => o.marketId === result.marketId);

            if (marketIndex === -1) {
              console.log('Record not found');
              return;
            }

            const market = markets[marketIndex];

            if (result.status !== 'CLOSED') return;

            let winnerSelectionId = result.runners.find(runner => runner.status === 'WINNER')?.selectionId;

            if (!market.runners || !winnerSelectionId) {
              await updateMarketAndEvent(market, winnerSelectionId);
              return;
            }

            const runnerIndex = _.findIndex(market.runners, (o) => o.SelectionId === winnerSelectionId);

            if (runnerIndex !== -1) {
              winnerSelectionId = market.runners[runnerIndex].runnerName;
            }

            await updateMarketAndEvent(market, winnerSelectionId);
          }

          async function updateMarketAndEvent(market, winnerInfo) {
            await MarketIDs.findOneAndUpdate({_id: market._id}, {$set: {winnerInfo}});

            if (market.marketName === 'Match Odds') {
              await Events.findOneAndUpdate({Id: market.eventId}, {$set: {winner: winnerInfo, isResultSaved: true}});
            } else {
              await Events.findOneAndUpdate({Id: market.eventId}, {$set: {isResultSaved: true}});
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
