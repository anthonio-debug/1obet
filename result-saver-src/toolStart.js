'use strict';
module.exports = toolStart;
const apiRequest = require('./apiRequest')();
const MarketIDs = require('../app/models/marketIds');

// const inplayevents = require('../app/models/events');

function toolStart() {
  return { init };

  async function init() {
    await setBrokenRecord();

    // getWaitingResultEvent();
    // getWaitingResultRacing();

    setInterval(() => {
      setBrokenRecord();
    }, 10 * 60 * 1000);
  }

  async function setBrokenRecord() {
    const checkOldRecordWithoutReady = await MarketIDs.find({
      readyForScore: { $ne: true },
      winnerInfo: null,
      runners: { $ne: null },
      status: { $ne: 'OPEN' }
    });

    for (let index = 0; index < checkOldRecordWithoutReady.length; index++) {
      const element = checkOldRecordWithoutReady[index];
      await MarketIDs.updateOne({ _id: element._id }, { $set: { readyForScore: true } });
    }
  }

  async function getWaitingResultEvent() {
    try {

      const eventMarkets = await MarketIDs.find({
        readyForScore: true,
        sportID: { $in: [1, 2, 4] },
        winnerInfo: null
      }).sort({ lastResultCheckTime: 1 }).limit(10).exec();
      if (eventMarkets.length > 0) {
        await apiRequest.getEventResult(eventMarkets);
      }

    } catch (error) {
      //console.log(error);
    } finally {
      setTimeout(() => {
        getWaitingResultEvent();
      }, 10000);
    }
  }

  async function getWaitingResultRacing() {
    try {
      const racingMarkets = await MarketIDs.find({
        readyForScore: true,
        sportID: { $nin: [1, 2, 4] },
        winnerInfo: null
      }).sort({ lastResultCheckTime: 1 }).limit(1).exec();
      if (racingMarkets.length > 0) {
        await apiRequest.getRacingResult(racingMarkets);
      }

    } catch (error) {
      //console.log(error);
    } finally {
      setTimeout(() => {
        getWaitingResultRacing();
      }, 3000);
    }
  }
}
