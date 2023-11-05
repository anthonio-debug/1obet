"use strict";
module.exports = ToolForAsian;

const apiRequests = require("./api/apiRequestsAsian")();

function ToolForAsian() {
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
