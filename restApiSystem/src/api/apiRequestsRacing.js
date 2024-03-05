
'use strict';
module.exports = apiRequests;

const axios = require('axios');

const Racing = require('../../../app/models/racing');
const Event = require('../../../app/models/events');
const raceMarkets = require('../../../app/models/raceMarkets');
const RaceOdds = require('../../../app/models/raceOdds')
const MarketIDS = require('../../../app/models/marketIds');

var _ = require('lodash');



const horseRaceUrl = "http://136.244.77.249:33333";
let io;


function apiRequests() {

  return { init, racesTodayMeetings, checkOdds };

  function init(_io, express) {
    io = _io;

    io.on('connection', onConnet);


  }



  function onConnet(socket) {
    socket.on("get_id", async (id) => {
      const eventInfo = await Event.findOne({ Id: id + '' }, { _id: 1 });

      if (eventInfo) {
        socket.emit('event_id_db', eventInfo);
      } else {
        // //console.log(eventInfo, id);
        //process.exit(1);
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
          socket.emit('race_err', 'Event Not Exist');
        }

      }

    });
  }


  async function racesTodayMeetings(sportsId, day) {
    try {
      const url = `${horseRaceUrl}/meetings/${day}/${sportsId}`;
      const response = await axios.get(url);

      const horseRacesData = response.data;
      const bulkOperations = [];


      const options = { upsert: true, new: true };

      //start event record

      if (!response.data.meetings) {
        // return //console.log('meetings empty. ' + url);
      } else {
        // //console.log('Racing Market Taken for '+sportsId + ' '+ day );
      }

      for (const meeting of response.data.meetings) {
        for (const race of meeting.races) {
          var statusDef = 'CLOSED';
          if (Date.parse(race.startTime) > Date.now()) {
            statusDef = 'WAITING';
          }


          var obj = {
            name: race.marketName,
            Id: race.raceId,
            marketIds: [race.marketId],
            openDate: Date.parse(race.startTime),
            meetingId: meeting.meetingId,
            meetingName: meeting.name,
            countryCode: meeting.countryCode,
            meetingOpenDate: meeting.openDate,
            venue: meeting.venue,
            meetingGoing: meeting.meetingGoing,
            sportsId: sportsId,
            status: statusDef
          }
          await Event.findOneAndUpdate({ Id: race.raceId }, obj, options);

          const marketID = await MarketIDS.findOne({ eventId: race.raceId, marketId: race.marketId + '' });

          if (!marketID) {
            const newMarket = new MarketIDS({
              eventId: race.raceId,
              marketId: race.marketId + '',
              marketName: meeting.name,
              sportID: sportsId,
              status: 'Race Market',
              index: 0
            });
           const r1 = await newMarket.save();
          } 
        };

      };
      //end events

      //record Racing
      for (const data of horseRacesData.meetings) {
        var temp = data;
        temp.countryCodes = horseRacesData.countryCodes;
        temp.sportsId = sportsId;
        bulkOperations.push({
          updateOne: {
            filter: { meetingId: temp.meetingId },
            update: { $setOnInsert: temp },
            upsert: true,
          },
        });
      }

      const r = await Racing.bulkWrite(bulkOperations, { ordered: false });
      //end racing


      //start check description//
      for (const data of horseRacesData.meetings) {
        for (const race of data.races) {
          if (!race || typeof race.marketId === 'undefined' || !race.marketId) {
            continue;
          }
          marketDescription(race.marketId);
        }
      }
      //end check description


    } catch (error) {
      // //console.log('Event Racing Problem');

      console.error(error);
    }
  }


  async function marketDescription(marketId) {
    try {
      const url = `${horseRaceUrl}/marketDescription/${marketId}`;
      const response = await axios.get(url);
      const marketListsData = response.data;

      // Extract relevant data from raceMarkets
      const eventTypeData = marketListsData.eventTypes;
      const eventNodeData = eventTypeData.eventNodes;
      const eventData = eventNodeData.event;
      const marketNodeData = eventNodeData.marketNodes;

      // Create an instance of the raceMarkets model
      const eventType = new raceMarkets({
        marketId: marketNodeData.marketId,
        eventTypeId: eventTypeData.eventTypeId,
        eventNodes: {
          eventId: eventNodeData.eventId,
          event: {
            eventName: eventData.eventName,
            countryCode: eventData.countryCode,
            timezone: eventData.timezone,
            venue: eventData.venue,
            openDate: new Date(eventData.openDate),
          },
          marketNodes: {
            marketId: marketNodeData.marketId,
            isMarketDataDelayed: marketNodeData.isMarketDataDelayed,
            state: {
              betDelay: marketNodeData.state.betDelay,
              startTime: new Date(marketNodeData.state.startTime),
              remainingTime: marketNodeData.state.remainingTime,
              bspReconciled: marketNodeData.state.bspReconciled,
              complete: marketNodeData.state.complete,
              inplay: marketNodeData.state.inplay,
              numberOfWinners: marketNodeData.state.numberOfWinners,
              numberOfRunners: marketNodeData.state.numberOfRunners,
              numberOfActiveRunners: marketNodeData.state.numberOfActiveRunners,
              lastMatchTime: new Date(marketNodeData.state.lastMatchTime),
              totalMatched: marketNodeData.state.totalMatched,
              totalAvailable: marketNodeData.state.totalAvailable,
              crossMatching: marketNodeData.state.crossMatching,
              runnersVoidable: marketNodeData.state.runnersVoidable,
              status: marketNodeData.state.status,
            },
            description: {
              persistenceEnabled: marketNodeData.description.persistenceEnabled,
              bspMarket: marketNodeData.description.bspMarket,
              marketName: marketNodeData.description.marketName,
              marketTime: new Date(marketNodeData.description.marketTime),
              suspendTime: new Date(marketNodeData.description.suspendTime),
              turnInPlayEnabled: marketNodeData.description.turnInPlayEnabled,
              marketType: marketNodeData.description.marketType,
              raceNumber: marketNodeData.description.raceNumber,
              raceType: marketNodeData.description.raceType,
              bettingType: marketNodeData.description.bettingType,
            },
            rates: {
              marketBaseRate: marketNodeData.rates.marketBaseRate,
              discountAllowed: marketNodeData.rates.discountAllowed,
            },
            runners: marketNodeData.runners.map(runner => ({
              selectionId: runner.selectionId,
              handicap: runner.handicap,
              description: {
                runnerName: runner.description.runnerName,
                metadata: {
                  SIRE_NAME: runner.description.metadata.SIRE_NAME,
                  CLOTH_NUMBER_ALPHA: runner.description.metadata.CLOTH_NUMBER_ALPHA,
                  OFFICIAL_RATING: runner.description.metadata.OFFICIAL_RATING,
                  COLOURS_DESCRIPTION: runner.description.metadata.COLOURS_DESCRIPTION,
                  COLOURS_FILENAME: runner.description.metadata.COLOURS_FILENAME,
                  FORECASTPRICE_DENOMINATOR: runner.description.metadata.FORECASTPRICE_DENOMINATOR,
                  DAMSIRE_NAME: runner.description.metadata.DAMSIRE_NAME,
                  WEIGHT_VALUE: runner.description.metadata.WEIGHT_VALUE,
                  SEX_TYPE: runner.description.metadata.SEX_TYPE,
                  DAYS_SINCE_LAST_RUN: runner.description.metadata.DAYS_SINCE_LAST_RUN,
                  WEARING: runner.description.metadata.WEARING,
                  OWNER_NAME: runner.description.metadata.OWNER_NAME,
                  DAM_YEAR_BORN: runner.description.metadata.DAM_YEAR_BORN,
                  SIRE_BRED: runner.description.metadata.SIRE_BRED,
                  JOCKEY_NAME: runner.description.metadata.JOCKEY_NAME,
                  DAM_BRED: runner.description.metadata.DAM_BRED,
                  ADJUSTED_RATING: runner.description.metadata.ADJUSTED_RATING,
                  runnerId: runner.description.metadata.runnerId,
                  CLOTH_NUMBER: runner.description.metadata.CLOTH_NUMBER,
                  SIRE_YEAR_BORN: runner.description.metadata.SIRE_YEAR_BORN,
                  TRAINER_NAME: runner.description.metadata.TRAINER_NAME,
                  COLOUR_TYPE: runner.description.metadata.COLOUR_TYPE,
                  AGE: runner.description.metadata.AGE,
                  DAMSIRE_BRED: runner.description.metadata.DAMSIRE_BRED,
                  JOCKEY_CLAIM: runner.description.metadata.JOCKEY_CLAIM,
                  FORM: runner.description.metadata.FORM,
                  FORECASTPRICE_NUMERATOR: runner.description.metadata.FORECASTPRICE_NUMERATOR,
                  BRED: runner.description.metadata.BRED,
                  DAM_NAME: runner.description.metadata.DAM_NAME,
                  DAMSIRE_YEAR_BORN: runner.description.metadata.DAMSIRE_YEAR_BORN,
                  STALL_DRAW: runner.description.metadata.STALL_DRAW,
                  WEIGHT_UNITS: runner.description.metadata.WEIGHT_UNITS,
                },
              },
              state: {
                adjustmentFactor: runner.state.adjustmentFactor,
                sortPriority: runner.state.sortPriority,
                lastPriceTraded: runner.state.lastPriceTraded,
                totalMatched: runner.state.totalMatched,
                status: runner.state.status,
              },
            })),
          },
        },
        isMarketDataVirtual: marketListsData.isMarketDataVirtual,
      });
      // Save the EventType instance to the database
      await eventType.save();


      var runners = [];

      for (let ix1 = 0; ix1 < marketNodeData.runners.length; ix1++) {
        const runner = marketNodeData.runners[ix1];
        runners.push({SelectionId: runner.selectionId, runnerName: runner.description.runnerName});
      }

      await MarketIDS.updateOne({ marketId: marketId, sportID: eventTypeData.eventTypeId }, { $set: {runners: runners} });

    } catch (error) {
      //console.log('Market data Problem');
      console.error(error);
    }
  }



  async function checkOdds() {


    const sportsIds = [4339, 7];

    for (let index = 0; index < sportsIds.length; index++) {

      ////console.log('Checking sportID '+ sportsIds[index]);
      var myArray = [];

      var events = await Event.find({
        sportsId: sportsIds[index] + '',
        status: 'OPEN'
      }).sort({ openDate: 1 }).limit(20).exec();



      if (events.length) {
        const checkOther = await Event.findOne({ status: 'WAITING', sportsId: sportsIds[index] + '' }).sort({ openDate: 1 });
        if (checkOther && checkOther.openDate < events[0].openDate) {
          await Event.updateMany({ status: 'OPEN', sportsId: sportsIds[index] + '' }, { status: 'WAITING' });
          // //console.log('Old event found. All OPEN events status changed with WAITING');
          return checkOdds();
        }
      }


      if (events.length != 20) {
        const documents = await Event.find({ status: 'WAITING', sportsId: sportsIds[index] + '' })
          .sort({ openDate: 1 })
          .limit(20 - events.length)
          .select('_id');

        ////console.log(documents.length, ' Selected racing: '+ sportsIds[index]);

        const documentIds = documents.map(doc => doc._id);
        await Event.updateMany({ _id: { $in: documentIds } }, { status: 'OPEN' });
        events = await Event.find({
          sportsId: sportsIds[index] + '',
          status: 'OPEN'
        }).sort({ openDate: 1 }).limit(20).exec();
      }


//console.log("events.length=================>",events.length);
      if (events.length == 0) {
        ////console.log('We not events for racing');
        continue;
      }
      for (let index = 0; index < events.length; index++) {
        const event = events[index];
        myArray.push({ eventId: event.Id, marketId: event.marketIds[0] });
      }
      raceOddsJob(myArray);
      ////console.log('odds event, ',myArray);


    }



  }

  async function raceOddsJob(array) {

    ////console.log('Racing markets',array);

    try {
      var ids = [];
      for (let index = 0; index < array.length; index++) {
        ids.push(array[index].marketId);
      }
      ////console.log(ids.join(','));
      const url = `${horseRaceUrl}/odds/?ids=` + ids.join(',');
      const response = await axios.get(url);
      const oddsData = response.data;
      var responsedMarketIDs = [];
      if (oddsData.length > 0) {
        for (const odds of oddsData) {
          if (odds && odds.update) {
            responsedMarketIDs.push(odds.marketId);
            if (typeof odds.state === 'undefined' || odds.state.status !== 'OPEN') {
              const ix = _.findIndex(array, function (o) { return o.marketId == odds.marketId; });
              if (ix != -1) {
                await Event.findOneAndUpdate({ Id: array[ix].eventId }, { status: odds.state.status, marketID: array[ix].marketId });
              }

              await MarketIDS.updateOne({ marketId: odds.marketId }, { $set: {readyForScore: true} });


              io.emit('racing_status', { status: odds.state.status, marketId: odds.marketId });

              io.to('$' + array[ix].marketId).emit('odds', odds);


            } else {
              const ix = _.findIndex(array, function (o) { return o.marketId == odds.marketId; });
              odds.createdAt = new Date().getTime()
              const result = await RaceOdds.collection.insertOne(odds);
              odds._id = result.insertedId;
              io.to('$' + array[ix].marketId).emit('odds', odds);
            }
          }
        }



        const filteredArray = array.filter((item) => !responsedMarketIDs.includes(item.marketId));


        for (let index = 0; index < filteredArray.length; index++) {
          await Event.findOneAndUpdate({ Id: filteredArray[index].eventId }, { $set: {status: 'CLOSED',readyForScore: true }});
          // //console.log(filteredArray[index].eventId, 'CLOSED 1');
          await MarketIDS.updateOne({ eventId: filteredArray[index].eventId }, { $set: {readyForScore: true} });
          io.emit('racing_status', { status: 'CLOSED', marketId: filteredArray[index].marketId });
        }

      } else {
        for (let i = 0; i < array.length; i++) {
          // //console.log(array[i].eventId, 'CLOSED 2');
          await Event.findOneAndUpdate({ Id: array[i].eventId }, { $set: {status: 'CLOSED',readyForScore: true }});
          await MarketIDS.updateOne({ eventId: array[i].eventId }, { $set: {readyForScore: true} });

        }
        // //console.log(oddsData);
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


}