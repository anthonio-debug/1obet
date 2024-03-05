'use strict';
module.exports = ToolForFancy;


const axios = require('axios');

const inPlayEvents = require('../../app/models/events');
const FancyEvent = require('../../app/models/fancyEvent');
const FancyOdds = require('../../app/models/fancyOdds');
const MarketIDs = require('../../app/models/marketIds');
const {FANCY_URI} = require("../../app/global/constants");
const MarketIDS = require("../../app/models/marketIds");

let io;
const fancyUrl = FANCY_URI;

function ToolForFancy() {
  return {init};

  async function init(_io, express) {

    io = _io;

    setInterval(fancyEventsBySupportJobs, 10 * 1000)
    setInterval(getList, 10 * 1000)
    setInterval(getFancyOdds, 1500)

    getList()
    fancyEventsBySupportJobs()
  }

  async function getList() {
    const url = `${fancyUrl}/highlights_bf_matches/4`;

    try {
      const response = await axios.get(url);
      const facyData = response.data;
      if (facyData.length == 0) {
        return;
      }
      for (let index = 0; index < facyData.length; index++) {
        var object = {
          eventId: facyData[index].gameId,
          marketId: facyData[index].marketId,
          data: facyData[index]
        };
        addOrUpdateEvent(object);
      }
    } catch (error) {
      console.error("Error getting fancy event list:", error);
    }
  }

  async function getFancyOdds() {

    try {
      let marketIds = [];
      let processArray = [];
      let events = await inPlayEvents.find({sportsId: '4', isShowed: true, hasFancy: true}, {Id: 1}).exec();

      for (let index = 0; index < events.length; index++) {
        const event = events[index];
        marketIds.push(event.Id);
        processArray.push(event.Id);
      }

      ////console.log(processArray.join(','));

      if (processArray.length > 0) {
        const url = `${fancyUrl}/bm_fancy_multi/` + processArray.join(',');
        const response = await axios.get(url);
        const facyOdds = response.data;
        let index = 0;
        if (facyOdds) {
          for (var key in facyOdds) {

            // //console.log(facyOdds, key);

            if (facyOdds.hasOwnProperty(key)) {
              try {
                var odd = facyOdds[key];

                if (odd && odd.data && odd.data.t3 && odd.data.t3.length > 0) {
                  odd.data.t3 = odd.data.t3.sort((a, b) => {
                    return a.nat.localeCompare(b.nat);
                  });
                }
                if (odd.gameId) {
                  let newFancyOdds = new FancyOdds({
                    eventId: odd.gameId,
                    marketId: key,
                    data: odd,
                  });
                  await newFancyOdds.save();

                  /* Necessary Records for result page. It's broken.

                  if (odd && odd.data && odd.data.t3 &&  odd.data.t3.length > 0) {
                  await MarketIDs.findOneAndUpdate(
                      { eventId: facyData[index].gameId,
                       },
                      {
                          eventId: eventId: facyData[index].gameId,
                          marketId: facyData[index].marketId + '',
                          marketName: meeting.name,
                          sportID: -1,
                          status: 'Race Market',
                          index: 0
                      },
                      {
                        new: true,          // güncellenmiş dokümanı döndürür
                        upsert: true        // eğer doküman yoksa, yeni bir doküman oluşturur
                      }
                  );
                  }
                  */
                  io.to('#' + odd.gameId).emit('fancy_odds', newFancyOdds);
                }

              } catch (error) {

                //console.log(processArray);
                //console.log(marketIds);
                //console.log(index);
                console.error("Error getting odds:", error);
              }

            }
            index++;
          }
        }
      }
    } catch (error) {
      console.error("Error getting odds:", error);
    }
  }

  async function addOrUpdateEvent(eventData) {
    const {marketId, ...restOfData} = eventData;

    try {
      await FancyEvent.findOneAndUpdate(
        {marketId: marketId},
        {...restOfData, marketId: marketId},
        {
          upsert: true,
          new: true
        }
      );
      //console.log("Event successfully added or updated.");
    } catch (error) {
      console.error("Error adding or updating event:", error);
    }
  }

  async function fancyEventsBySupportJobs() {

/*
    const oldSportsAPIUrl = "http://209.250.242.175:33332";
    function isValidDate(d) {
      return new Date(d).toString() !== "Invalid Date";
    }

    const url = `${oldSportsAPIUrl}/listEventsBySport/4`;
    try {
      const response = await axios.get(url);
      let events = response.data;
      //console.log('cricket event list------------------------------->', events.length)
      if (events.length > 0) {
        events = events.filter(function (item) {
          return isValidDate(item.openDate);
        });

        for (const event of events) {
          if (event.hasFancy) {
            //console.log('================= fancy found ===================')
            await inPlayEvents.findOneAndUpdate(
              { Id: event.Id },
              {
                $set: {
                  hasFancy: event.hasFancy,
                },
              },
              {
                upsert: true,
              }
            );
          }
        }

      } else {
        return {
          success: false,
          message: "Events empty",
        };
      }
    } catch (error) {
      console.error("Problem on taking fancy event list");
      console.error(error);
      return {
        success: false,
        message: "Failed to get or save fancy events",
        error: error.message,
      };
    } */
  }
}