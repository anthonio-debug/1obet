"use strict";
const MarketIDs = require("../../app/models/marketIds");
module.exports = ToolForResult;

const apiRequestResult = require("./api/apiRequestResult")();

function ToolForResult() {
  return { init };

  async function init(_io, express) {
    apiRequestResult.init(_io, express);

    fetchResults();
  }
  async function fetchResults() {
    console.log("running fetch results")
    try {
      const eventMarkets = await MarketIDs.find({
        readyForScore: true,
        sportID: {$in: [1, 2, 4]},
        winnerInfo: null
      }).sort({lastResultCheckTime: 1}).limit(10).exec();

      if (eventMarkets.length > 0) {
        await apiRequestResult.getEventResult(eventMarkets);
      }

    } catch (error) {
      console.log(error);
    } finally {
      setTimeout(() => {
        fetchResults();
      }, 3000);
    }
  }
}
