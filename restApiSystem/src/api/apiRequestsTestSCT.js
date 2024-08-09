'use strict';
module.exports = apiRequests;

const axios = require('axios');

const inPlayEvents = require('../../../app/models/events');
const MarketIDS = require('../../../app/models/marketIds');
const RaceOdds = require('../../../app/models/raceOdds');
const Score = require('../../../app/models/score');
const Odds = require('../../../app/models/odds');
const Crickets = require('../../../app/models/Crickets');
const FancyEvent = require('../../../app/models/fancyEvent');
var _ = require('lodash');
require('dotenv').config();
const config = require('../../../config/default.json');
const moment = require('moment');
const { CRICKET_LIVE_SET_MIN, SOCCER_LIVE_SET_MIN, TENNIS_LIVE_SET_MIN } = require('../../../helper/constants');
const { isObjectEqual } = require('../../../helper/common');

const OddsMap = new Map();

const header = {
  headers: {
    accept: 'application/json',
    'Content-Type': 'application/json',
    'X-App': process.env.XAPP_NAME
  }
};
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
    takeScores
  };

  function init(_io, express) {
    io = _io;
    io.on('connection', onConnet);
    //console.log("Express conf loading");

    express.get('/updateField', (req, res) => {
      try {
        if (req.query.id && req.query.data) {
          var d1 = Buffer.from(req.query.data, 'base64').toString('ascii');
          d1 = JSON.parse(d1);
          io.emit('updateMatch', { eventId: req.query.id, data: d1 });
        }
      } catch (error) {
        //console.log(error);
      }

      res.send('OK');
    });
  }

  function onConnet(socket) {
    //console.log("Socket connect");

    socket.on('join', async (channel) => {
      if (!channel) {
        return socket.emit('err', 'Channel Required');
      }

      if (channel.length == 0) {
        return socket.emit('err', 'Channel Required');
      }
      if (channel.charAt(0) == '#') {
        var event_information = await inPlayEvents.findOne({
          Id: channel.substring(1)
        });

        // console.log("outside of If .......................................................", event_information);
        if (event_information) {
          let cricket = null;
          let soccer = null;
          if (event_information.sportsId === '4') {
            const fancyEvents = await FancyEvent.findOne({
              eventId: channel.substring(1)
            });
            socket.emit('fancy_event_list', fancyEvents);
          }
          if (event_information.seriesKey) {
            if (event_information.sportsId === '1' || event_information.sportsId === '2') {
              soccer = await Score.findOne({
                scoreKey: event_information.seriesKey
              });
            }
          }

          cricket = await Crickets.findOne({
            eventId: event_information.Id
          });

          const lastScore = await Score.findOne({ eventId: channel.substring(1) }).sort({ _id: -1 });

          if (lastScore) {
            socket.emit('last_score', lastScore);
          } else {
            socket.emit('last_score', {
              status: false,
              msg: 'Score record is not exist for this event.'
            });
          }

          for (let index = 0; index < event_information.marketIds.length; index++) {
            const marketId = event_information.marketIds[index];

            const lOdds = await Odds.findOne({ marketId: marketId.id }).sort({ createdAt: -1 });
            if (lOdds) event_information.marketIds[index].last_odds = lOdds;
          }
          //console.log("------------------------------------------------>>>>>>>>",event_information);
          const marketIds = event_information.marketIds.map((item) => item.id);

          const Eventmarkets = await MarketIDS.find({
            //inPlay: true,
            eventId: event_information.Id
          }).exec();

          let totalMatched = 0;
          if (marketIds.length) {
            const odds = await Odds.findOne({ marketId: { $in: marketIds } }).sort({ totalMatched: -1 });
            if (odds) totalMatched = odds.totalMatched;
          }
          // console.log(".......................................................", event_information);
          socket.emit('event_info', { ...JSON.parse(JSON.stringify(event_information)), cricket, soccer, totalMatched, Eventmarkets });
        } else {
          socket.emit('err', 'Event Not Exist');
        }
      }

      socket.join(channel);
    });
  }

  async function takeScores2() {
    const results = await inPlayEvents.find({ inplay: true }, { Id: 1, theSportsId: 1, sportsId: 1, _id: 0 });
    const sportsIds = [];
    for (const item of results) {
      if (item.theSportsId) {
        let sportsName = 'cricket';
        if (item.sportsId === '1') {
          sportsName = 'football';
        } else if (item.sportsId === '2') {
          sportsName = 'tennis';
        }
        sportsIds.push({ theSportsId: item.theSportsId, sportsName, eventId: item.Id });
      }
    }
    for (const item of sportsIds) {
      const theSportsUrl = `https://api.thesports.com/v1/${item.sportsName}/match/live/history/?user=stepinn&secret=f365f74fbc01e6ecf55ba89bb725f504&uuid=${item.theSportsId}`;
      console.log('theSportsUrl', theSportsUrl);
      try {
        const { data } = await axios.get(theSportsUrl);
        console.log('takeScores2 success', item, data);
        const score = data?.results?.score;
        io.to('#' + item.eventId).emit('score2', score);
      } catch (error) {
        console.log('takeScores2 error', item, error);
      }
    }
  }

  async function takeScores() {
    var url = 'https://livesportscore.xyz:3440/api/bf_scores/';

    try {
      const results = await inPlayEvents.find({ inplay: true }, { Id: 1, _id: 0 });

      var events = [];
      if (results.length > 0) {
        for (let index = 0; index < results.length; index++) {
          //if (results[index].Id.length == 8)
          events.push(results[index].Id);
        }
        var response, scores;
        try {
          response = await axios.get(url + events.join(','));
          scores = response.data;
        } catch (error) {
          //console.log("Live sports score empty error");
          return;
        }
        if (scores.length > 0) {
          for (let index = 0; index < scores.length; index++) {
            const score = scores[index];
            io.to('#' + score.eventId).emit('score', score);
            const options = {
              upsert: true,
              new: true
            };

            const item = {
              eventId: score.eventId,
              data: score
            };

            await Score.findOneAndUpdate({ eventId: score.eventId }, item, options);
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
      return new Date(d).toString() !== 'Invalid Date';
    }

    let from = new Date();
    let to = new Date(from);
    to.setTime(to.getTime() + 2 * 24 * 60 * 60 * 1000);

    const requestData = {
      filter: {
        eventTypeIds: [sportsId]
        // "eventIds":
        //   sportsId === "1"
        //   ? soccerIds
        //   : sportsId === "4"
        //   ? cricketIds
        //   : []
      }
    };
    let url = `${config.newThirdURL}/listEvents`;
    try {
      const response = await axios.post(url, requestData, header);

      let events = response.data.result;

      if (events.length > 0) {
        events = events.filter(function (item) {
          return isValidDate(item.event.openDate);
        });
        let apiEventIds = [];
        for (const event of events) {
          const existingDoc = await inPlayEvents.findOne({ Id: event.event.id });

          if (existingDoc && existingDoc.isCanceled === true) {
            continue;
          }

          // var competitions = responseCompetition.data.result;
          await inPlayEvents.findOneAndUpdate(
            { Id: event.event.id },
            {
              $set: {
                sportsId: sportsId,
                // sportsId: '4',
                Id: event.event.id,
                name: event.event.name,
                countryCode: event.event.countryCode,
                timezone: event.event.timezone,
                openDate: Date.parse(event.event.openDate),
                // competitionId: competitions[0]?.competition?.id ? competitions[0]?.competition?.id : null,
                // competitionName: competitions[0]?.competition?.name ? competitions[0]?.competition?.name : null,
                inplayFromServer: false,

                status: 'OPEN',
                isPremium: false,
                type: event.event.type,
                matchTypeProvider: getMatchType(
                  // event.event.competitionName,
                  event.event.name,
                  sportsId
                )
              }
            },
            {
              upsert: true
            }
          );

          apiEventIds.push(event.event.id);
        }

        let dbEventIdS = [];
        const currentEvents = await inPlayEvents.find({ status: 'OPEN', sportsId: `${sportsId}` }, { Id: 1 });

        for (const event of currentEvents) {
          dbEventIdS.push(event.Id);
        }

        let diffs = dbEventIdS.filter((item) => !apiEventIds.includes(item));
        // if inplayFromServer is true on old records and not available on last list.
        // update event status with 'CLOSED-INPLAYLIST'
        // Also update MarketIDs
        for (const diff of diffs) {
          //console.log("Event is closed because it not exists on listEventsBySport: ", diff)
          await MarketIDS.updateMany({ eventId: diff }, { $set: { inPlay: false, status: 'CLOSED', readyForScore: true } });
          await inPlayEvents.updateOne(
            { Id: diff },
            {
              $set: {
                status: 'CLOSED-EVENTLIST',
                inplay: false,
                inplayFromServer: false,
                readyForScore: true
              }
            }
          );
          io.emit('inplay', { eventID: diff, inplay: false });
          io.to('eventStatusChange').emit('event_status', {
            eventId: diff,
            status: 'CLOSED-EVENTLIST'
          });
        }

        return {
          success: true,
          message: 'Events retrieved and saved successfully',
          events: events
        };
      } else {
        return {
          success: false,
          message: 'Events empty'
        };
      }
    } catch (error) {
      //console.log("Problem on taking event list");
      // console.error(error);
      return {
        success: false,
        message: 'Failed to get or save events',
        error: error.message
      };
    }
  }

  async function listMarketsByCronJob(eventId, sportID) {

    const requestData = {
      filter: {
        eventIds: [eventId]
      },
      maxResults: 100,
      marketProjection: ['EVENT', 'EVENT_TYPE', 'MARKET_START_TIME', 'MARKET_DESCRIPTION', 'RUNNER_DESCRIPTION']
    };
    console.log("EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE:", eventId);
    const url = `${config.newThirdURL}/listMarketCatalogue`;
    try {
      const response = await axios.post(url, requestData, header);

      const marketsData = response.data.result;
      let marketStatus = 'OPEN';


      if (marketsData && marketsData?.length > 0) {
        let marketIds = [];
        let arrMarketIds = [];
        let cntrl = 0;
        marketsData.forEach((element) => {

          let tempRunners = [];
          let hasbetfairFancy = false;
          if (config.activeProvider == 'old') {
            marketStatus = element.status;
          }
          for (let k = 0; k < element?.runners?.length; k++) {
            tempRunners.push({
              SelectionId: element?.runners[k]?.selectionId,
              runnerName: element?.runners[k]?.runnerName
            });
          }

          if (sportID == '4') {


            let completeMarketName = element.marketName;
            let FindInMeRes = completeMarketName.toLowerCase();
            let betfairFancy = FindInMeRes.search('overs line');


            let betfairFancy2 = FindInMeRes.search('runs line');

            //console.log("MarketName:", element.marketName);
            console.log('betfairFancy>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>', betfairFancy);
            console.log('betfairFancy2>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>', betfairFancy2);

            if (betfairFancy2 >= 0 || betfairFancy >= 0 || element.marketName === 'Match Odds' || element.marketName === 'Tied Match' || element.marketName === 'To Win the Toss') {

              if (betfairFancy >= 0 || betfairFancy2 >= 0) {

                hasbetfairFancy = true;
                console.log('completeMarketName>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>', completeMarketName);
                arrMarketIds[cntrl] = completeMarketName;
                cntrl++;

              }

              marketIds.push({
                id: element.marketId,
                marketName: element.marketName,
                sort: 1,
                openDate: Date.parse(element.marketStartTime),
                status: marketStatus,
                hasbetfairFancy: hasbetfairFancy,
                runners: tempRunners
              });
            }
          } else if (sportID == '2') {
            if (element.marketName === 'Match Odds')
              marketIds.push({
                id: element.marketId,
                marketName: element.marketName,
                openDate: Date.parse(element.marketStartTime),
                status: marketStatus,
                runners: tempRunners
              });
          } else if (sportID == '1') {
            if (
              element.marketName === 'Match Odds' ||
              element.marketName === 'Over/Under 0.5 Goals' ||
              element.marketName === 'Over/Under 1.5 Goals' ||
              element.marketName === 'Over/Under 2.5 Goals'
              // || element.marketName === "Over/Under 3.5 Goals"
              // || element.marketName === "Over/Under 4.5 Goals"
              // || element.marketName === "Over/Under 5.5 Goals"
            )
              marketIds.push({
                id: element.marketId,
                marketName: element.marketName,
                openDate: Date.parse(element.marketStartTime),
                status: marketStatus,
                runners: tempRunners
              });
          }
        });


        //console.log('============================================================================================', arrMarketIds);


        //console.log("=================length>>>>>>>>",arrMarketIds.length);

        //sorting start

        const sortedarrMarketIds = arrMarketIds.sort((a, b) => {
          return a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: 'base'
          })
        });
        //sorting end      
        console.log("=================length>>>>>>>>", sortedarrMarketIds.length);
        console.log("=================length>>>>>>>>", marketIds.length);
        // console.log("I am sorted:::::::::::::::::::::::::::::::", sortedarrMarketIds);

        sortedarrMarketIds.indexOf("Apple");

        for (let index = 0; index < marketIds.length; index++) {

          var ev = parseInt(eventId);
          const marketID = await MarketIDS.findOne({
            eventId: ev,
            marketId: marketIds[index].id + ''
          });

          if (marketIds[index].hasbetfairFancy == true) {
            //console.log("MarkentName::::::::::::::::::::::::::::",marketIds[index].marketName);
            // console.log("Index::::::::::::::::::::::::::::",sortedarrMarketIds.indexOf(marketIds[index].marketName));
            marketIds[index].sort = sortedarrMarketIds.indexOf(marketIds[index].marketName);
          }

          if (!marketID) {
            const countOfMarket = await MarketIDS.countDocuments({ eventId: eventId, status: 'OPEN' });

            if (countOfMarket > (sportID === '1' ? config.soccerEventsAllowedCount : sportID === '2' ? config.tennistEventsAllowedCount : sportID === '4' ? config.cricketEventsAllowedCount : config.allSportsEventsAllowedCount)) {
              return;
            } else {

              const newMarket = new MarketIDS({
                eventId: eventId,
                marketId: marketIds[index].id + '',
                marketName: marketIds[index].marketName,
                sportID: sportID,
                totalMatched: marketIds[index].totalMatched,
                status: marketIds[index].status,
                index: index,
                runners: marketIds[index].runners,
                inPlay: true
              });
              await newMarket.save();
              console.log(`marketIds=========================${marketIds.length}`)
              console.log(`marketIds=========================${marketIds.map(data => console.log(data))}`)
            }
          } else {
            const newmarkets2 = await MarketIDS.findOneAndUpdate({ eventId: ev, marketId: marketIds[index].id + '' }, { status: marketIds[index].status });
            console.log(`newmarkets2=========================${newmarkets2}`)
          }
        }

        await inPlayEvents.findOneAndUpdate({ Id: eventId }, { marketIds: marketIds })
          .then((CheckEvnts) => {
            if (!CheckEvnts) {
              console.error(`No document found with eventId: ${eventId} for update.`);
            } else {
              console.log("Check Events:", CheckEvnts);
            }
          })
          .catch((error) => {
            console.error(`Failed to update inPlayEvents for eventId: ${eventId}`, error);
          });


      }
    } catch (error) {
      console.error(error);
      return {
        success: false,
        message: 'Failed to get listMarketsByCronJob',
        error: error.message
      };
    }
  }


  async function getOddsFromProvider(marketIdsArray, intervalId) {
    let tempArray = [];
    let tempArrayForIDs = [];
    for (let index = 0; index < marketIdsArray.length; index++) {
      const el = marketIdsArray[index];

      tempArray.push({
        market: el.marketId,
        eventId: el.eventId,
        indexID: el.index
      });

      tempArrayForIDs.push(`${el.marketId}`);
    }

    const requestData = {
      marketIds: tempArrayForIDs
    };

    const url = `${config.newThirdURL}/listMarketBook`;
    axios.post(url, requestData, header).then(
      async (response) => {
        if (!response?.data?.result) return;
        const oddsData = response.data.result;
        let checkedMarkets = [];

        if (oddsData.length > 0) {
          let counter = 0;
          try {
            for (let index = 0; index < oddsData.length; index++) {
              counter = counter + 1;
              const element = oddsData[index];

              if (typeof element.runners !== undefined) {
                if (
                  element.runners[0]?.ex.availableToLay.length > 0 ||
                  element.runners[0]?.ex.availableToBack.length > 0 ||
                  element.runners[1]?.ex.availableToLay.length > 0 ||
                  element.runners[1]?.ex.availableToBack.length > 0 ||
                  element.runners[2]?.ex.availableToLay.length > 0 ||
                  element.runners[2]?.ex.availableToBack.length > 0
                ) {
                  checkedMarkets.push(element.marketId);

                  const marketData = await MarketIDS.findOne({ marketId: `${element.marketId}` })
                    .sort({ lastCheckMarket: 1 })
                    .limit(1)
                    .exec();
                  const eventId = marketData.eventId;
                  const marketId = element.marketId;
console.log(marketData,"---------4444444444444-------------44444444444---------after-marketdata");

                  // Filter runners with status "ACTIVE"
                  const activeRunners = element.runners.filter((runner) => runner.status === 'ACTIVE');

                  // Get the number of active runners
                  const numberOfActiveRunners = activeRunners.length;

                  // IsMarketDataDelayed
                  let isMarketDataDelayed = false;

                  if (config.activeProvider == 'old') {
                    isMarketDataDelayed = element.isMarketDataDelayed;
                  }

                  let tempRunners = [];
                  for (let n = 0; n < element.runners?.length; n++) {

                    //console.log("eeeeeeeeeeeeeeeeee:",element);
                    let totalMatched = element.totalMatched;
                    //console.log("BEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF::::",totalMatched);

                    let totalMatchedStr = totalMatched.toString();
                    // Ensure sentence is a string before using replace
                    if (typeof totalMatchedStr === 'string') {
                      totalMatchedStr = totalMatchedStr.replace('.', '');
                    } else {
                      console.log('sentence is not a string');
                    }

                    // console.log("AFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:",totalMatchedStr);


                    let tempElement = {
                      SelectionId: element.runners[n]?.selectionId,
                      runnerName: marketData?.runners[n]?.runnerName,
                      Status: element.runners[n]?.status,
                      LastPriceTraded: element.runners[n]?.lastPriceTraded,
                      TotalMatched: totalMatchedStr,
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
                          }
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
                          }
                        ]
                      }
                    };

                    tempRunners.push(tempElement);
                  }
                  // let sttr = element.totalMatched;
                  // const totalMatched = sttr.replace('.','');



                  //console.log("------------------------------->"+element.totalMatched);

                  let totalMatched = element.totalMatched;
                  let totalMatchedStr = totalMatched.toString();
                  // Ensure sentence is a string before using replace
                  if (typeof totalMatchedStr === 'string') {
                    totalMatchedStr = totalMatchedStr.replace('.', '');
                  } else {
                    console.log('sentence is not a string');
                  }








                  let frontData = {
                    sportsId: marketData.sportID,
                    runners: tempRunners,
                    marketId: marketId,
                    isMarketDataDelayed: isMarketDataDelayed,
                    status: element.status,
                    eventId: eventId,
                    isInplay: element.inplay,
                    numberOfRunners: element.runners.length,
                    numberOfActiveRunners: numberOfActiveRunners,
                    totalMatched: totalMatchedStr
                  };

                  if (!OddsMap.has(marketId) || !isObjectEqual(OddsMap.get(marketId), frontData)) {
                    OddsMap.set(marketId, frontData);
                    let json1 = {
                      sportsId: marketData.sportID,
                      runners: tempRunners,
                      marketId: marketId,
                      isMarketDataDelayed: isMarketDataDelayed,
                      status: element.status,
                      eventId: eventId,
                      isInplay: element.inplay,
                      numberOfRunners: element.runners.length,
                      numberOfActiveRunners: numberOfActiveRunners,
                      totalMatched: totalMatchedStr,
                      createdAt: new Date().getTime()
                    };
                    //console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>",element.status);
                    if (element.status === 'CLOSED') {
                      // clearInterval(intervalId);
                      await MarketIDS.updateOne({ marketId: marketId }, { inPlay: false, status: element.status });
                    } else {
                      await MarketIDS.updateOne({ marketId: marketId }, { status: element.status });
                    }

                    if (runnerCheckerArray.indexOf(marketId) === -1) {
                      let runners = [];

                      for (let ix1 = 0; ix1 < element.runners.length; ix1++) {
                        const runner = element.runners[ix1];
                        runners.push({
                          SelectionId: runner.selectionId,
                          runnerName: runner.runnerName
                        });
                      }

                      if (runners.length > 0) {
                        await MarketIDS.updateOne({ marketId: marketId, runners: null }, { $set: { runners: runners } });
                        runnerCheckerArray.push(marketId);
                      }
                    }
                    // console.log('sportsId:' + json1 + '-->marketId:' + json1.marketId);
                    let el = new Odds(json1);
                    await el.save();

                    const ix = _.findIndex(tempArray, function (o) {
                      return o.market == marketId;
                    });

                    if (ix !== -1 && tempArray[ix].indexID === 0) {
                      io.to('homepage').emit('odds', {
                        marketId: marketId,
                        data: el,
                        eventId: element.eventId,
                        status: 'NewOddsHomepage'
                      });
                    }
                    io.to('#' + eventId).emit('odds', {
                      marketId: marketId,
                      data: el,
                      eventId: eventId,
                      status: 'NewOdds'
                    });
                  }
                }
              }
            }

            const filteredArray = tempArray.filter((item) => !checkedMarkets.includes(item.market));

            for (let index = 0; index < filteredArray.length; index++) {
              OddsMap.delete(filteredArray[index]?.market);
              await MarketIDS.updateOne({ marketId: filteredArray[index]?.market }, { inPlay: false, status: 'CLOSED-ODDS-EMPTY' });
            }
          } catch (error) {
            console.error('getOddsFromProvider----->', error);
          }
        }
      },
      (error) => {
        console.error('getOddsFromProvider-->', error);
      }
    );
  }

  /*
  Checking In play for set inplayFromServer and close the event.
  */
  async function checkInPlay(sportID) {
    const requestData = {
      filter: {
        eventTypeIds: [sportID],
        maxResults: 200,
        turnInPlayEnabled: true,
        inPlayOnly: true
      }
    };
    let url = `${config.newThirdURL}/listEvents`;
    try {
      axios.post(url, requestData, header).then(
        async (response) => {
          // Take last inplay list for events
          const events = response.data.result;
          if (!events || events?.length === 0) {
            //console.log('checkInPlay: api res is empty')
            return;
          }

          let apiLiveEventIds = [];
          for (const event of events) {
            const eventId = event.event.id;
            apiLiveEventIds.push(eventId);

            let ix = _.findIndex(removedInplayList, function (o) {
              return o.id === eventId;
            });
            if (ix !== -1) {
              //console.log("Event InPlay Value Problem:");
              //console.log(removedInplayList[ix]);
              removedInplayList.splice(ix, 1);
            }

            //update these events inplay status with data that was come from data provider.
            await inPlayEvents.updateOne({ Id: eventId }, { inplayFromServer: true, inplay: true });
          }

          // check old inplayFromServer true record. Match with new list.
          let dbLiveEventIds = [];
          const dbLiveEvents = await inPlayEvents.find({ inplayFromServer: true, sportsId: `${sportID}` }, { Id: 1 });

          for (const event of dbLiveEvents) {
            dbLiveEventIds.push(event.Id);
          }

          let diffs = dbLiveEventIds.filter((item) => !apiLiveEventIds.includes(item));
          // if inplayFromServer is true on old records and not available on last list.
          // update event status with 'CLOSED-INPLAYLIST'
          // Also update MarketIDs
          for (const diff of diffs) {
            const inPlayEvent = await inPlayEvents.findOne({ Id: diff });
            const sportsId = inPlayEvent.sportsId;
            if (['1', '2', '4'].includes(sportsId)) {
              const openDate = moment(inPlayEvent.openDate).utc().valueOf();
              const now = moment().utc().valueOf();
              let limitMin = 0;
              switch (sportsId) {
                case '1':
                  limitMin = SOCCER_LIVE_SET_MIN;
                  break;
                case '2':
                  limitMin = TENNIS_LIVE_SET_MIN;
                  break;
                case '4':
                  limitMin = CRICKET_LIVE_SET_MIN;
                  break;
              }
              if (openDate - now < limitMin * 60 * 1000 && openDate - now > 0) {
                continue;
              }
            }

            let ix = _.findIndex(removedInplayList, function (o) {
              return o.id === diff;
            });

            if (ix === -1) {
              removedInplayList.push({ id: diff, date: new Date() });
            }

            //console.log(`Event is closed because it not exists on inplaylist: ${diff}`)

            await MarketIDS.updateMany({ eventId: diff }, { $set: { inPlay: false, status: 'CLOSED', readyForScore: true } });

            await inPlayEvents.updateOne(
              { Id: diff },
              {
                $set: {
                  status: 'CLOSED-INPLAYLIST',
                  inplay: false,
                  inplayFromServer: false,
                  readyForScore: true
                }
              }
            );

            io.emit('inplay', { eventID: diff, inplay: false });

            io.to('eventStatusChange').emit('event_status', {
              eventId: diff,
              status: 'CLOSED-INPLAYLIST'
            });
          }
        },
        (error) => {
          console.error('checkInPlay', error);
        }
      );
    } catch (error) {
      console.error('checkInPlay', error);
    }
  }

  async function setInplay(sportsId) {

    try {
      const markets = await MarketIDS.find({
        inPlay: true,
        sportID: sportsId,
        status: 'OPEN'
      }).exec();

      //check current active inplaying MarketIDS
      if (markets.length > 19) {
        //console.log("Inplay Events is Full");
        return;
      }

      var count = markets.length;

      // Take list of inplay Event. If this event have new marketids that is added after the match start. Add this marketids to checking list.
      const inPlayEventsDocs = await inPlayEvents.find({ inplay: true, sportsId: sportsId + '' }, 'Id').sort({ openDate: 1 });

      const eventIds = inPlayEventsDocs.map((doc) => doc.Id);

      const marketIDsPlaying = await MarketIDS.find({
        eventId: { $in: eventIds },
        status: 'OPEN',
        inPlay: { $ne: true }
      }).sort({ index: 1 });

      if (marketIDsPlaying.length > 0) {
        for (let x = 0; x < marketIDsPlaying.length; x++) {
          const market = marketIDsPlaying[x];
          await MarketIDS.updateOne({ _id: market._id }, { inPlay: true }).exec();
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
        openDate: { $gt: currentTime },
        inplayFromServer: true,
        sportsId: sportsId + '',
        status: 'OPEN',
        inplay: { $ne: true },
        isShowed: true
      };

      var events = await inPlayEvents.find(query).sort({ openDate: 1 }).limit(10).exec();

      if (events.length == 0) {
        const queryPastEvents = {
          inplayFromServer: true,
          sportsId: sportsId + '',
          isShowed: true,
          status: 'OPEN',
          inplay: { $ne: true }
        };
        events = await inPlayEvents.find(queryPastEvents).sort({ openDate: -1 }).limit(10).exec();
      }
      console.log('events............');
      console.log(events);
      console.log('events-------------');
      for (let index = 0; index < events.length; index++) {
        const event = events[index];
        // Before the set inplay true
        // We are taking last marketIDs record from data provider.

        await listMarketsByCronJob(event.Id, event.sportsId);

        //if we have active marketIDS, we are add these marketIds to check list.
        const marketIDs = await MarketIDS.find({
          eventId: event.Id,
          status: 'OPEN'
        }).sort({ index: 1 });

        if (marketIDs.length > 0) {
          //console.log(event.Id + " -> " + event.name + " event updated with inplay");

          await inPlayEvents.updateMany({ Id: event.Id }, { inplay: true }).exec();

          io.emit('inplay', { eventID: event.Id, inplay: true });

          for (let x = 0; x < marketIDs.length; x++) {
            const market = marketIDs[x];
            await MarketIDS.updateOne({ _id: market._id }, { inPlay: true }).exec();
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
          //await MarketIDS.deleteMany({ eventId: event.Id }).exec();;
          //console.log(event.Id + " was closed. MarketIDS is empty");
          await inPlayEvents.updateOne({ Id: event.Id }, { inPlay: false, status: 'CLOSED-MARKETIDS' });
        }
      }
    } catch (error) {
      console.error('setInplay', error);
    }
  }
}

function getMatchType(
  // competitionName,
  name,
  sportsId
) {
  const keywords = /(T20|twenty20|Twenty20|twenty 20|Twenty 20|ODI|One Day|one day|T10|Ten10||ten 10|Ten 10|Test|TEST)/i;
  if (sportsId == '4') {
    const nameMatch = name.match(keywords);
    // const competitionNameMatch =
    //   competitionName && competitionName.match(keywords);
    let returnMatch = '';
    if (nameMatch) {
      returnMatch = nameMatch[0];
    }
    // else if (competitionNameMatch) {
    //   returnMatch = competitionNameMatch[0];
    // }

    if (['ODI', 'One Day', 'one day'].includes(returnMatch)) {
      returnMatch = 'ODI';
    } else if (['Test', 'test'].includes(returnMatch)) {
      returnMatch = 'TEST';
    } else if (['twenty20', 'Twenty20', 'Twenty 20', 'twenty 20'].includes(returnMatch)) {
      returnMatch = 'T20';
    } else if (['T10', 'Ten10', 'ten 10', 'Ten 10'].includes(returnMatch)) {
      returnMatch = 'T10';
    }
    return returnMatch;
  }
}
