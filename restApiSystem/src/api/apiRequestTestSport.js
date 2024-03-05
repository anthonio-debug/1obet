"use strict";
module.exports = apiRequests;

const axios = require("axios");

const inPlayEvents = require("../../../app/models/events");
const MarketIDS = require("../../../app/models/marketIds");
const RaceOdds = require("../../../app/models/raceOdds");
const Score = require("../../../app/models/score");
const Odds = require("../../../app/models/odds");
const FancyEvent = require("../../../app/models/fancyEvent");
var _ = require("lodash");
const config = require("../../../config/default.json")
require('dotenv').config()

const sportsAPIUrl = "http://185.58.225.212:8080/api";
const header = {
  headers: {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'X-App': process.env.XAPP_NAME
  },
}
let io;

let runnerCheckerArray = [];
let removedInplayList = [];

function apiRequests() {
  return {
    init,
    eventsBySupportJobs,
    listMarketsByCronJob,
    getOddsFromProvider,
    checkInPlay,
    setInplay,
    takeScores,
  };

  function init(_io, express) {
    io = _io;
    io.on("connection", onConnet);
    //console.log("Express conf loading");

    express.get("/updateField", (req, res) => {
      try {
        if (req.query.id && req.query.data) {
          var d1 = Buffer.from(req.query.data, "base64").toString("ascii");
          d1 = JSON.parse(d1);
          io.emit("updateMatch", {eventId: req.query.id, data: d1});
        }
      } catch (error) {
        //console.log(error);
      }

      res.send("OK");
    });
  }

  function onConnet(socket) {
    //console.log("Socket connect");

    socket.on("join", async (channel) => {
      if (!channel) {
        return socket.emit("err", "Channel Required");
      }

      if (channel.length == 0) {
        return socket.emit("err", "Channel Required");
      }
      if (channel.charAt(0) == "#") {
        var event_information = await inPlayEvents.findOne({
          Id: channel.substring(1),
        });

        if (event_information) {
          if (event_information.sportsId == 4) {
            const fancyEvents = await FancyEvent.findOne({
              eventId: channel.substring(1),
            });
            socket.emit("fancy_event_list", fancyEvents);
          }

          const lastScore = await Score.find({eventId: channel.substring(1)})
            .sort({_id: -1})
            .limit(1);

          if (lastScore.length > 0) {
            socket.emit("last_score", lastScore[0]);
          } else {
            socket.emit("last_score", {
              status: false,
              msg: "Score record is not exist for this event.",
            });
          }

          for (
            let index = 0;
            index < event_information.marketIds.length;
            index++
          ) {
            const marketId = event_information.marketIds[index];

            const lOdds = await Odds.find({marketId: marketId.id})
              .sort({createdAt: -1})
              .limit(1);
            if (lOdds.length > 0)
              event_information.marketIds[index].last_odds = lOdds[0];
          }
          socket.emit("event_info", event_information);
        } else {
          socket.emit("err", "Event Not Exist");
        }
      }

      socket.join(channel);
    });
  }

  async function takeScores() {
    var url = "https://livesportscore.xyz:3440/api/bf_scores/";

    try {
      const results = await inPlayEvents.find(
        {inplay: true},
        {Id: 1, _id: 0}
      );

      var events = [];
      if (results.length > 0) {
        for (let index = 0; index < results.length; index++) {
          //if (results[index].Id.length == 8)
          events.push(results[index].Id);
        }
        var response, scores;
        try {
          response = await axios.get(url + events.join(","));
          scores = response.data;
        } catch (error) {
          //console.log("Live sports score empty error");
          return;
        }
        if (scores.length > 0) {
          for (let index = 0; index < scores.length; index++) {
            const score = scores[index];
            io.to("#" + score.eventId).emit("score", score);
            const options = {
              upsert: true,
              new: true,
            };

            const item = {
              eventId: score.eventId,
              data: score,
            };

            await Score.findOneAndUpdate(
              {eventId: score.eventId},
              item,
              options
            );
          }
        }
      } else {
        //console.log("Events emp");
      }
    } catch (error) {
      //console.log(error);
    }
  }

  async function eventsBySupportJobs(sportsId) {
    function isValidDate(d) {
      return new Date(d).toString() !== "Invalid Date";
    }

    const cricketIds = ['32853038','32901645','32892409']
    const soccerIds = ["32880557","32905041","32886273","32904657","32896485","32899492","32906029","32901990","32901973"]

    const requestData = {
      "filter": {
        "eventTypeIds": [sportsId],
        "eventIds": sportsId == "1" ? soccerIds : sportsId == "4" ? cricketIds : ["1"]
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
          const existingDoc = await inPlayEvents.findOne({Id: event.event.id});

          if (existingDoc && existingDoc.isCanceled === true) {
            continue;
          }

          if (existingDoc && existingDoc.inplayFromServer != event.event.inplay) {
            // //console.log(existingDoc);
            // //console.log(event.inplay);
          }

          // const competitionRequest = {
          //   "filter": {
          //     "eventTypeIds": [sportsId],
          //     "eventIds": [event.event.id],
          //     "countryCodes": [event.event.countryCode]
          //   }
          // }

          // const getCompetitionUrl = `${sportsAPIUrl}/listCompetitions`;

          // const responseCompetition = await axios.post(
          //   getCompetitionUrl,
          //   competitionRequest,
          //   header
          // );

          // var competitions = responseCompetition.data.result;
          await inPlayEvents.findOneAndUpdate(
            {Id: event.event.id},
            {
              $set: {
                sportsId: sportsId,
                Id: event.event.id,
                name: event.event.name,
                countryCode: event.event.countryCode,
                timezone: event.event.timezone,
                openDate: Date.parse(event.event.openDate),
                // competitionId: competitions[0]?.competition?.id ? competitions[0]?.competition?.id : null,
                // competitionName: competitions[0]?.competition?.name ? competitions[0]?.competition?.name : null,
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
        const currentEvents = await inPlayEvents.find(
          {status: 'OPEN', sportsId: sportsId + ""},
          {Id: 1}
        );

        for (let i = 0; i < currentEvents.length; i++) {
          allIDS.push(currentEvents[i].Id);
        }

        var diff = allIDS.filter((item) => !eventIDs.includes(item));
        // if inplayFromServer is true on old records and not available on last list.
        // update event status with 'CLOSED-INPLAYLIST'
        // Also update MarketIDs
        for (let i = 0; i < diff.length; i++) {
          //console.log(
            "Event is closed because it not exists on listEventsBySport: " +
            diff[i]
          );
          await MarketIDS.updateMany(
            {eventId: diff[i]},
            {$set: {inPlay: false, status: 'CLOSED', readyForScore: true}}
          );
          await inPlayEvents.updateOne(
            {Id: diff[i]},
            {
              $set: {
                status: 'CLOSED-EVENTLIST',
                inplay: false,
                inplayFromServer: false,
                readyForScore: true,
              },
            }
          );
          io.emit("inplay", {eventID: diff[i], inplay: false});
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
      //console.log("Problem on taking event list");
      // console.error(error);
      return {
        success: false,
        message: "Failed to get or save events",
        error: error.message,
      };
    }
  }

  async function listMarketsByCronJob(eventId, sportID) {
    const requestData = {
      "filter": {
        "eventIds": [eventId],
      },
      "maxResults": 25,
      "marketProjection": ["RUNNER_DESCRIPTION", "RUNNER_METADATA"]
    }

    var url = `${sportsAPIUrl}/listMarketCatalogue`;
    try {
      const response = await axios.post(
        url,
        requestData,
        header
      );

      const marketsData = response.data.result;
      let marketStatus = 'OPEN';

      if (config.activeProvider == 'old') {
        marketStatus = element.status
      }

      if (marketsData.length > 0) {
        let marketIds = [];
        if (sportID === '4') {
          marketsData.forEach((element) => {

            if (
              element.marketName === 'Match Odds'
              || element.marketName === 'Tied Match'
              || element.marketName === 'To Win the Toss'
            ) {
              marketIds.push({
                id: element.marketId,
                marketName: element.marketName,
                status: marketStatus,
                runners: element.runners
              });
            }
          });
        } else {
          marketsData.forEach((element) => {
            marketIds.push({
              id: element.marketId,
              marketName: element.marketName,
              status: marketStatus,
              runners: element.runners
            });
          });
        }

        for (let index = 0; index < marketIds.length; index++) {
          var ev = parseInt(eventId);
          if (
            marketIds[index].marketName !== "Most Sixes"
            && marketIds[index].marketName !== "Super Over"
            && marketIds[index].marketName !== "Top South Africa Batter"
            && marketIds[index].marketName !== "2nd Innings 10 Overs Line"
            && marketIds[index].marketName !== "Match Odds Including Tie"
            && marketIds[index].marketName !== "2nd Innings 15 Overs Line"
            && marketIds[index].marketName !== "2nd Innings 12 Overs Line"
          ) {
            const marketID = await MarketIDS.findOne({
              eventId: ev,
              marketId: marketIds[index].id + "",
            });
            if (!marketID) {
              const newMarket = new MarketIDS({
                eventId: eventId,
                marketId: marketIds[index].id + "",
                marketName: marketIds[index].marketName,
                sportID: sportID,
                status: marketIds[index].status,
                index: index,
                runners: marketIds[index].runners
              });
              await newMarket.save();
            } else {
              await MarketIDS.findOneAndUpdate(
                {eventId: ev, marketId: marketIds[index].id + ""},
                {status: marketIds[index].status}
              );
            }
          }
        }

        await inPlayEvents.findOneAndUpdate(
          {Id: eventId},
          {marketIds: marketIds},
          {upsert: true, new: true}
        );
      }
    } catch (error) {
      // console.error(error);
      return {
        success: false,
        message: "Failed to get listMarketsByCronJob",
        error: error.message,
      };
    }
  }

  async function getOddsFromProvider(marketIdsArray) {
    var tempArry = [];
    var tempArryForIDs = [];

    for (let index = 0; index < marketIdsArray?.length; index++) {
      const el = marketIdsArray[index];
      tempArry.push({
        market: el.marketId,
        eventId: el.eventId,
        indexID: el.index,
      });
      tempArryForIDs.push(`${el.marketId}`);
    }

    const requestData = {
      "marketIds": tempArryForIDs
    }

    var url = `${sportsAPIUrl}/listMarketBook`;
    axios.post(
      url,
      requestData,
      header
    ).then(
      async (response) => {
        const oddsData = response.data.result;
        var checkedMarkets = [];
        if (oddsData.length > 0) {
          try {
            for (let index = 0; index < oddsData.length; index++) {
              const element = oddsData[index];

              if (typeof element.runners !== undefined) {
                if (
                  element.runners[0]?.ex.availableToLay.length > 0
                  || element.runners[0]?.ex.availableToBack.length > 0
                  || element.runners[1]?.ex.availableToLay.length > 0
                  || element.runners[1]?.ex.availableToBack.length > 0
                  || element.runners[2]?.ex.availableToLay.length > 0
                  || element.runners[2]?.ex.availableToBack.length > 0
                ) {
                  checkedMarkets.push(element.marketId);

                  const marketData = await MarketIDS.findOne({marketId: `${element.marketId}`})
                    .sort({lastCheckMarket: 1})
                    .limit(1)
                    .exec();

                  // Filter runners with status "ACTIVE"
                  const activeRunners = element.runners.filter(runner => runner.status === "ACTIVE");

                  // Get the number of active runners
                  const numberOfActiveRunners = activeRunners.length;

                  // IsMarketDataDelayed
                  let isMarketDataDelayed = false;

                  if (config.activeProvider == 'old') {
                    isMarketDataDelayed = element.isMarketDataDelayed
                  }

                  var tempRunners = [];
                  var tempRaceRunners = [];

                  if (marketData.sportID !== 7) {
                    for (let n = 0; n < element.runners?.length; n++) {
                      var tempElement = {
                        SelectionId: element.runners[n]?.selectionId,
                        runnerName: marketData?.runners[n]?.runnerName,
                        Status: element.runners[n]?.status,
                        LastPriceTraded: element.runners[n]?.lastPriceTraded,
                        TotalMatched: element.runners[n]?.totalMatched,
                        ExchangePrices: {
                          AvailableToBack: [
                            {
                              price: element.runners[n]?.ex.availableToBack[0]?.price,
                              size: element.runners[n]?.ex.availableToBack[0]?.size
                            },
                            {
                              price: element.runners[n]?.ex.availableToBack[1]?.price,
                              size: element.runners[n]?.ex.availableToBack[1]?.size
                            },
                            {
                              price: element.runners[n]?.ex.availableToBack[2]?.price,
                              size: element.runners[n]?.ex.availableToBack[2]?.size
                            },
                          ],
                          AvailableToLay: [
                            {
                              price: element.runners[n]?.ex.availableToLay[0]?.price,
                              size: element.runners[n]?.ex.availableToLay[0]?.size
                            },
                            {
                              price: element.runners[n]?.ex.availableToLay[1]?.price,
                              size: element.runners[n]?.ex.availableToLay[1]?.size
                            },
                            {
                              price: element.runners[n]?.ex.availableToLay[2]?.price,
                              size: element.runners[n]?.ex.availableToLay[2]?.size
                            },
                          ]
                        }
                      }

                      tempRunners.push(tempElement)
                    }
                  } else {
                    for (let n = 0; n < element.runners?.length; n++) {
                      var tempElement = {
                        selectionId: element.runners[n]?.selectionId,
                        handicap: element.runners[n]?.handicap,
                        state: {
                          adjustmentFactor: element.runners[n]?.adjustmentFactor,
                          lastPriceTraded: element.runners[n]?.lastPriceTraded,
                          totalMatched: element.runners[n]?.totalMatched,
                          status: element.runners[n]?.status,
                        },
                        exchange: {
                          availableToBack: [
                            {
                              price: element.runners[n]?.ex.availableToBack[0]?.price,
                              size: element.runners[n]?.ex.availableToBack[0]?.size
                            },
                            {
                              price: element.runners[n]?.ex.availableToBack[1]?.price,
                              size: element.runners[n]?.ex.availableToBack[1]?.size
                            },
                            {
                              price: element.runners[n]?.ex.availableToBack[2]?.price,
                              size: element.runners[n]?.ex.availableToBack[2]?.size
                            },
                          ],
                          availableToLay: [
                            {
                              price: element.runners[n]?.ex.availableToLay[0]?.price,
                              size: element.runners[n]?.ex.availableToLay[0]?.size
                            },
                            {
                              price: element.runners[n]?.ex.availableToLay[1]?.price,
                              size: element.runners[n]?.ex.availableToLay[1]?.size
                            },
                            {
                              price: element.runners[n]?.ex.availableToLay[2]?.price,
                              size: element.runners[n]?.ex.availableToLay[2]?.size
                            },
                          ]
                        }
                      }

                      tempRaceRunners.push(tempElement)
                    }
                  }

                  var json1 = {
                    sportsId: marketData.sportID,
                    runners: tempRunners,
                    marketId: element.marketId,
                    isMarketDataDelayed: isMarketDataDelayed,
                    status: element.status,
                    eventId: marketData.eventId,
                    isInplay: element.inplay,
                    numberOfRunners: element.runners.length,
                    numberOfActiveRunners: numberOfActiveRunners,
                    totalMatched: element.totalMatched,
                    createdAt: new Date().getTime(),
                  };

                  var json2 = {
                    marketId: element.marketId,
                    isMarketDataDelayed: isMarketDataDelayed,
                    state: {
                      status: element.status,
                      inplay: element.inplay,
                      totalMatched: element.totalMatched
                    },
                    runners: tempRaceRunners,
                    createdAt: new Date().getTime(),
                  }

                  if (element.Status != "OPEN") {
                    await MarketIDS.updateOne(
                      {marketId: element.marketId},
                      {inPlay: false, status: element.status}
                    );
                  }

                  if (runnerCheckerArray.indexOf(element.marketId) === -1) {
                    var runners = [];
                    for (let ix1 = 0; ix1 < element.runners.length; ix1++) {
                      const runner = element.runners[ix1];
                      runners.push({
                        SelectionId: runner.SelectionId,
                        runnerName: runner.runnerName,
                      });
                    }

                    if (runners.length > 0) {
                      await MarketIDS.updateOne(
                        {marketId: element.marketId, runners: null},
                        {$set: {runners: runners}}
                      );
                      runnerCheckerArray.push(element.marketId);
                    }
                  }

                  if (marketData.sportID !== 7) {
                    var el = new Odds(json1);
                    el.save();
                  } else {
                    var el = new RaceOdds(json2);
                    el.save();
                  }


                  const ix = _.findIndex(tempArry, function (o) {
                    return o.market == element.marketId;
                  });

                  if (ix != -1 && tempArry[ix].indexID == 0) {
                    io.to("homepage").emit("odds", {
                      marketId: element.marketId,
                      data: el,
                      eventId: element.eventId,
                      status: "NewOddsHomepage",
                    });
                  }
                  io.to("#" + element.eventId).emit("odds", {
                    marketId: element.marketId,
                    data: el,
                    eventId: element.eventId,
                    status: "NewOdds",
                  });
                }
              }
            }

            const filteredArray = tempArry.filter(
              (item) => !checkedMarkets.includes(item.market)
            );

            for (let index = 0; index < filteredArray.length; index++) {
              await MarketIDS.updateOne(
                {marketId: filteredArray.market},
                {inPlay: false, status: "CLOSED-ODDS-EMPTY"}
              );
            }
          } catch (error) {
            //console.log(error);
          }
        }
      },
      (error) => {
        //console.log(error);
      }
    );
  }

  /*
  Checking In play for set inplayFromServer and close the event.
  */
  async function checkInPlay(sportID) {
    var url = `${sportsAPIUrl}/listInplayEvents/${sportID}`;
    try {
      axios.get(url).then(
        async (response) => {
          // Take last inplay list for events

          const marketsData = response.data;
          var eventIDs = [];
          if (marketsData.length > 0) {
            for (let i = 0; i < marketsData.length; i++) {
              const event = marketsData[i];
              eventIDs.push(event.Id);

              var ix = _.findIndex(removedInplayList, function (o) {
                return o.Id == event.Id;
              });
              if (ix !== -1) {
                //console.log("Event Inplay Value Problem:");
                //console.log(removedInplayList[ix]);
                removedInplayList.splice(ix, 1);
              }

              //update this events inplay status with data that was come from data provider.
              await inPlayEvents.updateOne(
                {Id: event.Id},
                {inplayFromServer: true, status: event.status}
              );
            }
          } else {
            //console.log("List Empty");
            return;
          }

          // check old inplayFromServer true record. Match with new list.
          var allIDS = [];
          const currentEvents = await inPlayEvents.find(
            {inplayFromServer: true, sportsId: sportID + ""},
            {Id: 1}
          );

          for (let i = 0; i < currentEvents.length; i++) {
            allIDS.push(currentEvents[i].Id);
          }

          var diff = allIDS.filter((item) => !eventIDs.includes(item));
          // if inplayFromServer is true on old records and not available on last list.
          // update event status with 'CLOSED-INPLAYLIST'
          // Also update MarketIDs
          for (let i = 0; i < diff.length; i++) {
            var ix = _.findIndex(removedInplayList, function (o) {
              return o.Id == diff[i];
            });

            if (ix === -1) {
              removedInplayList.push({id: diff[i], date: new Date()});
            }

            //console.log(
              "Event is closed because it not exists on inplaylist: " + diff[i]
            );
            await MarketIDS.updateMany(
              {eventId: diff[i]},
              {$set: {inPlay: false, status: "CLOSED", readyForScore: true}}
            );
            await inPlayEvents.updateOne(
              {Id: diff[i]},
              {
                $set: {
                  status: "CLOSED-INPLAYLIST",
                  inplay: false,
                  inplayFromServer: false,
                  readyForScore: true,
                },
              }
            );
            io.emit("inplay", {eventID: diff[i], inplay: false});
            io.to("eventStatusChange").emit("event_status", {
              eventId: diff[i],
              status: "CLOSED-INPLAYLIST",
            });
          }
        },
        (error) => {
          // //console.log(error);
          return {
            success: false,
            message: "Failed to get checkInPlay",
            error: error.message,
          };
        }
      );
    } catch (error) {
      // console.error(error);
      return {
        success: false,
        message: "Failed to get checkInPlay",
        error: error.message,
      };
    }
  }

  async function setInplay(sportsId) {
    try {
      const markets = await MarketIDS.find({
        inPlay: true,
        sportID: sportsId,
        status: "OPEN",
      }).exec();

      //check current active inplaying MarketIDS
      if (markets.length > 19) {
        //console.log("Inplay Events is Full");
        return;
      }

      var count = markets.length;

      // Take list of inplay Event. If this event have new marketids that is added after the match start. Add this marketids to checking list.
      const inPlayEventsDocs = await inPlayEvents
        .find({inplay: true, sportsId: sportsId + ""}, "Id")
        .sort({openDate: 1});
      const eventIds = inPlayEventsDocs.map((doc) => doc.Id);
      const marketIDsPlaying = await MarketIDS.find({
        eventId: {$in: eventIds},
        status: "OPEN",
        inPlay: {$ne: true},
      }).sort({index: 1});
      if (marketIDsPlaying.length > 0) {
        for (let x = 0; x < marketIDsPlaying.length; x++) {
          const market = marketIDsPlaying[x];
          await MarketIDS.updateOne(
            {_id: market._id},
            {inPlay: true}
          ).exec();
          //console.log(market.marketId + " market updated with inplay");
          count++;
          if (count > 19) {
            break;
          }
        }
        if (count > 19) {
          return;
        }
      }

      //if list is full return;
      if (count > 19) {
        return;
      }

      // if current active marketIDs less then 20. Take a event that is looking inplay true from dataprovider.
      // We are storing 'inplay' that is coming data provider and we saving this value with name inplayFromServer
      // Take inplayFromServer from database and take marketIDs.
      // If these events have valid marketIDS(status='OPEN')
      const currentTime = Date.now();
      const query = {
        openDate: {$gt: currentTime},
        inplayFromServer: true,
        sportsId: sportsId + "",
        status: "OPEN",
        inplay: {$ne: true},
        isShowed: true,
      };

      var events = await inPlayEvents
        .find(query)
        .sort({openDate: 1})
        .limit(10)
        .exec();

      if (events.length == 0) {
        const queryPastEvents = {
          inplayFromServer: true,
          sportsId: sportsId + "",
          isShowed: true,
          status: "OPEN",
          inplay: {$ne: true},
        };
        events = await inPlayEvents
          .find(queryPastEvents)
          .sort({openDate: -1})
          .limit(10)
          .exec();
      }

      for (let index = 0; index < events.length; index++) {
        const event = events[index];
        // Before the set inplay true
        // We are taking last marketIDs record from data provider.

        await listMarketsByCronJob(event.Id, event.sportsId);

        //if we have active marketIDS, we are add these marketIds to check list.
        const marketIDs = await MarketIDS.find({
          eventId: event.Id,
          status: "OPEN",
        }).sort({index: 1});
        if (marketIDs.length > 0) {
          //console.log(
            event.Id + " -> " + event.name + " event updated with inplay"
          );
          await inPlayEvents
            .updateMany({Id: event.Id}, {inplay: true})
            .exec();
          io.emit("inplay", {eventID: event.Id, inplay: true});
          for (let x = 0; x < marketIDs.length; x++) {
            const market = marketIDs[x];
            await MarketIDS.updateOne(
              {_id: market._id},
              {inPlay: true}
            ).exec();
            //console.log(market.marketId + " market updated with inplay");
            count++;
            //console.log(count);
            if (count > 19) {
              break;
            }
          }
          if (count > 19) {
            break;
          }
        } else {
          //If this event not have to marketIDS, we update the status of event with CLOSED.
          await MarketIDS.deleteMany({ eventId: event.Id }).exec();
          //console.log(event.Id + " was closed. MarketIDS is empty");
          await inPlayEvents.updateOne({ Id: event.Id }, { inPlay: false, status: 'CLOSED-MARKETIDS' });
        }
      }
    } catch (error) {
      console.error(error);
      return {
        success: false,
        message: "Failed to get setInplay",
        error: error.message,
      };
    }
  }
}

function getMatchType(
  // competitionName,
  name,
  sportsId
) {
  const keywords =
    /(T20|twenty20|Twenty20|twenty 20|Twenty 20|ODI|One Day|one day|T10|Ten10||ten 10|Ten 10|Test|TEST)/i;
  if (sportsId == "4") {
    const nameMatch = name.match(keywords);
    // const competitionNameMatch =
    //   competitionName && competitionName.match(keywords);
    let returnMatch = "";
    if (nameMatch) {
      returnMatch = nameMatch[0];
    }
    // else if (competitionNameMatch) {
    //   returnMatch = competitionNameMatch[0];
    // }

    if (["ODI", "One Day", "one day"].includes(returnMatch)) {
      returnMatch = "ODI";
    } else if (["Test", "test"].includes(returnMatch)) {
      returnMatch = "TEST";
    } else if (
      ["twenty20", "Twenty20", "Twenty 20", "twenty 20"].includes(returnMatch)
    ) {
      returnMatch = "T20";
    } else if (["T10", "Ten10", "ten 10", "Ten 10"].includes(returnMatch)) {
      returnMatch = "T10";
    }
    return returnMatch;
  }
}
