
'use strict';
module.exports = apiRequests;

const axios = require('axios');

const Racing = require('../../../app/models/racing');
const raceMarkets = require('../../../app/models/raceMarkets');
const RaceOdds = require('../../../app/models/raceOdds')
const MarketIDS = require('../../../app/models/marketIds');
const InPlayEvents = require("../../../app/models/events");

var _ = require('lodash');

const horseRaceUrl = "http://185.58.225.212:8080/api";

const header =  {
  headers: {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'X-App': 'testqms'
  },
}

let io;

function apiRequests() {

  return { init, racesTodayMeetings, checkOdds, listMarketsByCronJob, eventsBySupportJobs, raceOddsJob };

  function init(_io, express) {
    io = _io
    io.on('connection', onConnet);
  }

  function onConnet(socket) {
    socket.on("get_id", async (id) => {
      const eventInfo = await InPlayEvents.findOne({ Id: id + '' }, { _id: 1 });

      if (eventInfo) {
        socket.emit('event_id_db', eventInfo);
      } else {
        console.log(eventInfo, id);
      }
    });

    socket.on("join", async (channel) => {

      if (!channel) {
        return socket.emit('err', 'Channel Required');
      }

      if (channel.length == 0) {
        return socket.emit('err', 'Channel Required');
      }
      if (channel.charAt(0) == '$') {
        var event_information = await raceMarkets.findOne({ marketId: channel.substring(1) });

        if (event_information) {
          const LastRaceOdds = await RaceOdds.findOne({ marketId: channel.substring(1) });

          if (LastRaceOdds) {
            socket.emit('race_last_odds', LastRaceOdds);
          } else {
            socket.emit('race_last_odds', { status: false, msg: 'LastRaceOdds record is not exist for this event.' });
          }

          socket.emit('race_event_info', event_information);
        } else {
          socket.emit('race_err', 'InPlayEvents Not Exist');
        }
      }
    });
  }

  /**++++++++++++++++++ new added code ( Inplayevents ) +++++++++++++++++++++++++**/
  async function eventsBySupportJobs(sportsId) {
    function isValidDate(d) {
      return new Date(d).toString() !== "Invalid Date";
    }

    const requestData = {
      "filter": {
        "eventTypeIds": [sportsId],
      }
    }

    var url = `${sportsAPIUrl}/listEvents`;

    try {
      const response = await axios.post(
        url,
        requestData,
        header
      );
      
      var events = response.data.result;
      if (events.length > 0) {
        events = events.filter(function (item) {
          return isValidDate(item.event.openDate);
        });

        for (const event of events) {
          const existingDoc = await InPlayEvents.findOne({ Id: event.event.id });

          if (existingDoc && existingDoc.isCanceled === true) {
            continue;
          }

          if (existingDoc && existingDoc.inplayFromServer != event.event.inplay) {
            // console.log(existingDoc);
            // console.log(event.inplay);
          }

          await InPlayEvents.findOneAndUpdate(
            { Id: event.event.id },
            {
              $set: {
                sportsId: sportsId,
                Id: event.event.id,
                name: event.event.name,
                countryCode: event.event.countryCode,
                timezone: event.event.timezone,
                openDate: Date.parse(event.event.openDate),
                inplayFromServer: false,
                hasFancy: false,
                status: 'OPEN',
                isPremium: false,
                type: event.event.type,
                matchTypeProvider: getMatchType(
                  // event.event.competitionName,
                  event.event.name,
                  sportsId
                ),
              },
            },
            {
              upsert: true,
            }
          );
        }

        var eventIDs = [];

        for (let index = 0; index < events.length; index++) {
          eventIDs.push(events[index].event.id);
        }

        var allIDS = [];
        const currentEvents = await InPlayEvents.find(
          { status: 'OPEN', sportsId: sportsId + "" },
          { Id: 1 }
        );

        for (let i = 0; i < currentEvents.length; i++) {
          allIDS.push(currentEvents[i].Id);
        }

        var diff = allIDS.filter((item) => !eventIDs.includes(item));
        // if inplayFromServer is true on old records and not available on last list.
        // update event status with 'CLOSED-INPLAYLIST'
        // Also update MarketIDs
        for (let i = 0; i < diff.length; i++) {
          console.log(
            "InPlayEvents is closed because it not exists on listEventsBySport: " +
              diff[i]
          );
          await MarketIDS.updateMany(
            { eventId: diff[i] },
            { $set: { inPlay: false, status: 'CLOSED', readyForScore: true } }
          );
          await InPlayEvents.updateOne(
            { Id: diff[i] },
            {
              $set: {
                status: 'CLOSED-EVENTLIST',
                inplay: false,
                inplayFromServer: false,
                readyForScore: true,
              },
            }
          );
          io.emit("inplay", { eventID: diff[i], inplay: false });
          io.to("eventStatusChange").emit("event_status", {
            eventId: diff[i],
            status: 'CLOSED-EVENTLIST',
          });
        }

        return {
          success: true,
          message: "Events retrieved and saved successfully",
          events: events,
        };
      } else {
        return {
          success: false,
          message: "Events empty",
        };
      }
    } catch (error) {
      console.log("Problem on taking event list");
      // console.error(error);
      return {
        success: false,
        message: "Failed to get or save events",
        error: error.message,
      };
    }
  }

  /**++++++++++++++++++ new added code ( racemarkets collection ) +++++++++++++++++++++++++**/
  async function listMarketsByCronJob(eventId, sportsId, competitionId) {
    try {
      const requestData = {
        "filter": {
          "eventIds": [eventId],
          "eventTypeIds": [sportsId],
          "marketTypes": ['WIN'],
        },
        "maxResults": 100,
        "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "RUNNER_DESCRIPTION", "RUNNER_METADATA"]
      }
  
      const url = `${horseRaceUrl}/listMarketCatalogue`;
      let response = await axios.post(
        url,
        requestData,
        header
      );

      const eventsData = response.data.result;

      let marketIds = [];
      // Create an instance of the raceMarkets model
      for (let j = 0; j < eventsData.length; j ++) {
        marketIds.push(eventsData[j].marketId);
        const eventType = new raceMarkets({
          marketId: eventsData[j].marketId,
          eventTypeId: eventsData[j].eventType.id,
          eventNodes: {
            eventId: eventsData[j].event.id,
            event: {
              eventName: eventsData[j].event.name,
              countryCode: eventsData[j].event.countryCode,
              timezone: eventsData[j].event.timezone,
              venue: eventsData[j].event.venue,
              openDate: new Date(eventsData[j].event.openDate)
            },
            marketNodes: {
              marketId: eventsData[j].marketId,
              state: {
                startTime: new Date(eventsData[j].marketStartTime),
                numberOfRunners: eventsData[j].runners?.length,
                totalMatched: eventsData[j].totalMatched,
                status: "OPEN"
              },
              description: {
                marketName: eventsData[j].marketName,
              },
              runners: eventsData[j].runners.map(runner => ({
                selectionId: runner.selectionId,
                handicap: runner.handicap,
                description: {
                  runnerName: runner.runnerName,
                  metadata: {
                    SIRE_NAME: runner.metadata.SIRE_NAME,
                    CLOTH_NUMBER_ALPHA: runner.metadata.CLOTH_NUMBER_ALPHA,
                    OFFICIAL_RATING: runner.metadata.OFFICIAL_RATING,
                    COLOURS_DESCRIPTION: runner.metadata.COLOURS_DESCRIPTION,
                    COLOURS_FILENAME: runner.metadata.COLOURS_FILENAME,
                    FORECASTPRICE_DENOMINATOR: runner.metadata.FORECASTPRICE_DENOMINATOR,
                    DAMSIRE_NAME: runner.metadata.DAMSIRE_NAME,
                    WEIGHT_VALUE: runner.metadata.WEIGHT_VALUE,
                    SEX_TYPE: runner.metadata.SEX_TYPE,
                    DAYS_SINCE_LAST_RUN: runner.metadata.DAYS_SINCE_LAST_RUN,
                    WEARING: runner.metadata.WEARING,
                    OWNER_NAME: runner.metadata.OWNER_NAME,
                    DAM_YEAR_BORN: runner.metadata.DAM_YEAR_BORN,
                    SIRE_BRED: runner.metadata.SIRE_BRED,
                    JOCKEY_NAME: runner.metadata.JOCKEY_NAME,
                    DAM_BRED: runner.metadata.DAM_BRED,
                    ADJUSTED_RATING: runner.metadata.ADJUSTED_RATING,
                    runnerId: runner.metadata.runnerId,
                    CLOTH_NUMBER: runner.metadata.CLOTH_NUMBER,
                    SIRE_YEAR_BORN: runner.metadata.SIRE_YEAR_BORN,
                    TRAINER_NAME: runner.metadata.TRAINER_NAME,
                    COLOUR_TYPE: runner.metadata.COLOUR_TYPE,
                    AGE: runner.metadata.AGE,
                    DAMSIRE_BRED: runner.metadata.DAMSIRE_BRED,
                    JOCKEY_CLAIM: runner.metadata.JOCKEY_CLAIM,
                    FORM: runner.metadata.FORM,
                    FORECASTPRICE_NUMERATOR: runner.metadata.FORECASTPRICE_NUMERATOR,
                    BRED: runner.metadata.BRED,
                    DAM_NAME: runner.metadata.DAM_NAME,
                    DAMSIRE_YEAR_BORN: runner.metadata.DAMSIRE_YEAR_BORN,
                    STALL_DRAW: runner.metadata.STALL_DRAW,
                    WEIGHT_UNITS: runner.metadata.WEIGHT_UNITS,
                  },
                },
                state: {
                  sortPriority: runner.sortPriority,
                },
              })),
            },
          },
          
        });
        // Save the EventType instance to the database
        await eventType.save();
        
        var runners = [];
        for (let ix1 = 0; ix1 < eventsData[j].runners.length; ix1++) {
          const runner = eventsData[j].runners[ix1];
          runners.push({SelectionId: runner.selectionId, runnerName: runner.runnerName});
        }
        await MarketIDS.updateOne({ marketId: eventsData[j].marketId, sportID: eventsData[j].eventType.id }, { $set: {runners: runners} });
      }
      await InPlayEvents.findOneAndUpdate({ Id: eventsData[j].event.id }, { $set: {marketIds: marketIds} }, { upsert: true, new: true } );
    } catch (error) {
      console.log('Market data Problem');
      console.error(error);
    }
  }

  /**++++++++++++++++++ new added code ( racemarkets collection ) +++++++++++++++++++++++++**/
  async function raceOddsJob(data) {
    try {  
      const requestData = {
        "marketIds": data.marketIds
      }
  
      var url = `${sportsAPIUrl}/listMarketBook`;

      const oddsData = await axios.post( url, requestData, header );

      var responsedMarketIDs = [];
      if (oddsData.length > 0) {
        for (const odds of oddsData) {
          if (odds && odds.update) {
            responsedMarketIDs.push(odds.marketId);
            if (typeof odds.state === 'undefined' || odds.state.status !== 'OPEN') {
              const ix = _.findIndex(array, function (o) { return o.marketId == odds.marketId; });
              if (ix != -1) {
                await InPlayEvents.findOneAndUpdate({ Id: array[ix].eventId }, { status: odds.status, marketID: array[ix].marketId });
              }

              await MarketIDS.updateOne({ marketId: odds.marketId }, { $set: {readyForScore: true} });

              io.emit('racing_status', { status: odds.status, marketId: odds.marketId });

              io.to('$' + array[ix].marketId).emit('odds', odds);
            } else {
              const ix = _.findIndex(array, function (o) { return o.marketId == odds.marketId; });
              odds.createdAt = new Date().getTime()

              var tempRunners = [];
              for (let n = 0; n < odds.runners?.length; n++) {
                var tempElement = {
                  SelectionId: odds.runners[n]?.selectionId,
                  runnerName: marketData?.runners[n]?.runnerName,
                  Status: odds.runners[n]?.status,
                  LastPriceTraded: odds.runners[n]?.lastPriceTraded,
                  TotalMatched: odds.runners[n]?.totalMatched,
                  ExchangePrices: {
                    AvailableToBack: [
                      {
                        price: odds.runners[n]?.ex.availableToBack[0]?.price,
                        size: odds.runners[n]?.ex.availableToBack[0]?.size
                      },
                      {
                        price: odds.runners[n]?.ex.availableToBack[1]?.price,
                        size: odds.runners[n]?.ex.availableToBack[1]?.size
                      },
                      {
                        price: odds.runners[n]?.ex.availableToBack[2]?.price,
                        size: odds.runners[n]?.ex.availableToBack[2]?.size
                      },
                    ],
                    AvailableToLay: [
                      {
                        price: odds.runners[n]?.ex.availableToLay[0]?.price,
                        size: odds.runners[n]?.ex.availableToLay[0]?.size
                      },
                      {
                        price: odds.runners[n]?.ex.availableToLay[1]?.price,
                        size: odds.runners[n]?.ex.availableToLay[1]?.size
                      },
                      {
                        price: odds.runners[n]?.ex.availableToLay[2]?.price,
                        size: odds.runners[n]?.ex.availableToLay[2]?.size
                      },
                    ]
                  }
                }

                tempRunners.push(tempElement)
              }

              var json = {
                marketId: odds.marketId,
                isMarketDataDelayed: isMarketDataDelayed,
                state: odds.status,
                runners: tempRunners,
                createdAt: new Date().getTime(),
              }
              const result = await RaceOdds.collection.insertOne(json);
              odds._id = result.insertedId;

              io.to('$' + array[ix].marketId).emit('odds', json);
            }
          }
        }

        const filteredArray = array.filter((item) => !responsedMarketIDs.includes(item.marketId));

        for (let index = 0; index < filteredArray.length; index++) {
          await InPlayEvents.findOneAndUpdate({ Id: filteredArray[index].eventId }, { $set: {status: 'CLOSED',readyForScore: true }});
          console.log(filteredArray[index].eventId, 'CLOSED 1');
          await MarketIDS.updateOne({ eventId: filteredArray[index].eventId }, { $set: {readyForScore: true} });
          io.emit('racing_status', { status: 'CLOSED', marketId: filteredArray[index].marketId });
        }

      } else {
        for (let i = 0; i < array.length; i++) {
          console.log(array[i].eventId, 'CLOSED 2');
          await InPlayEvents.findOneAndUpdate({ Id: array[i].eventId }, { $set: {status: 'CLOSED',readyForScore: true }});
          await MarketIDS.updateOne({ eventId: array[i].eventId }, { $set: {readyForScore: true} });
        }
        console.log(oddsData);
      }
      return ({
        success: true,
        message: 'Odds Records',
      });
    } catch (error) {
      console.error(error);
      return ({
        success: false,
        message: 'Error retrieving Records',
      });
    }
  }

  async function checkOdds() {
    const sportsIds = [4339, 7];

    for (let index = 0; index < sportsIds.length; index++) {
      var myArray = [];

      var events = await InPlayEvents.find({
        sportsId: sportsIds[index] + '',
        status: 'OPEN'
      }).sort({ openDate: 1 }).limit(20).exec();

      if (events.length) {
        const checkOther = await InPlayEvents.findOne({ status: 'WAITING', sportsId: sportsIds[index] + '' }).sort({ openDate: 1 });
        if (checkOther && checkOther.openDate < events[0].openDate) {
          await InPlayEvents.updateMany({ status: 'OPEN', sportsId: sportsIds[index] + '' }, { status: 'WAITING' });
          console.log('Old event found. All OPEN events status changed with WAITING');
          return checkOdds();
        }
      }

      if (events.length != 20) {
        const documents = await InPlayEvents.find({ status: 'WAITING', sportsId: sportsIds[index] + '' })
          .sort({ openDate: 1 })
          .limit(20 - events.length)
          .select('_id');

        const documentIds = documents.map(doc => doc._id);
        await InPlayEvents.updateMany({ _id: { $in: documentIds } }, { status: 'OPEN' });
        events = await InPlayEvents.find({
          sportsId: sportsIds[index] + '',
          status: 'OPEN'
        }).sort({ openDate: 1 }).limit(20).exec();
      }

      if (events.length == 0) {
        continue;
      }
      for (let index = 0; index < events.length; index++) {
        const event = events[index];
        myArray.push({ eventId: event.Id, marketId: event.marketIds[0] });
      }
      raceOddsJob(myArray);
    }
  }
}