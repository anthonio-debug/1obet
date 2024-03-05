"use strict";
module.exports = ToolForTestSport;

const apiRequests = require("./api/apiRequestTestSport")();

function ToolForTestSport() {
  return { init };

  async function init(_io, express) {
    apiRequests.init(_io, express);
 
    fetchOdds();
  }
 
  function fetchOdds() {
    // //console.log("running fetch odds")
    // apiRequests.getOddsFromProvider()
    //   .then(() => {
    //     setTimeout(fetchOdds, 10)
    //   })
    //   .catch(err => {
    //     //console.log(err);
    //     // Schedule the next call even if there's an error
    //     setTimeout(fetchOdds, 30);
    //   });
  }
}
 
