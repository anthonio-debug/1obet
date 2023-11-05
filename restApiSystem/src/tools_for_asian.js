"use strict";
module.exports = ToolForEvent;

const apiRequests = require("./api/apiRequestsTeen20")();

function ToolForEvent() {
  return { init };

  async function init(_io, express) {
    apiRequests.init(_io, express);

    setInterval(() => {
      fetchOdds();
    }, 1000);
  }
  async function fetchOdds() {
    try {
      apiRequests.getOddsFromProvider();
    } catch (error) {
      console.error("Error fetching odds:", error);
    }
  }
}
