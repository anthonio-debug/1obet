'use strict';
module.exports = apiRequests;

const axios = require('axios');

const inPlayEvents = require('../../../app/models/events');
const MarketIDS = require('../../../app/models/marketIds');
const Score = require('../../../app/models/score');
const Odds = require('../../../app/models/odds');
const FancyEvent = require('../../../app/models/fancyEvent');
var _ = require('lodash');


const sportsAPIUrl = 'http://209.250.242.175:33332';
let io;




function apiRequests() {

  return { init, eventsBySupportJobs, listMarketsByCronJob, getOddsFromProvider, checkInPlay, setInplay, takeScores };

  function init(_io, express) {
    io = _io;
    io.on('connection', onConnet);

    console.log('Express conf loading');
  }

  function onConnet(socket) {
    console.log('Socket connect');

    socket.on("join", async (channel) => {

      if (!channel) {
        return socket.emit('err', 'Channel Required');
      }

      if (channel.length == 0) {
        return socket.emit('err', 'Channel Required');
      }
      if (channel.charAt(0) == '#') {
        var event_information = await inPlayEvents.findOne({ Id: channel.substring(1) });

        if (event_information) {


          if (event_information.sportsId == 4) {
            const fancyEvents = await FancyEvent.findOne({ eventId: channel.substring(1) });
            socket.emit('fancy_event_list', fancyEvents);
            /*
            const lastFancyOdds = await FancyOdds.find({ eventId: channel.substring(1) }).sort({created: -1}).limit(2);

            if (lastFancyOdds.length > 1) {
              setTimeout(() => {
                socket.emit('fancy_odds', lastFancyOdds[1]);
              }, 2000);
              
            }
            */
          }

          const lastScore = await Score.find({ eventId: channel.substring(1) }).sort({ _id: -1 }).limit(1);;

          if (lastScore.length > 0) {
            socket.emit('last_score', lastScore[0]);
          } else {
            socket.emit('last_score', { status: false, msg: 'Score record is not exist for this event.' });
          }

          for (let index = 0; index < event_information.marketIds.length; index++) {
            const marketId = event_information.marketIds[index];

            const lOdds = await Odds.find({ marketId: marketId.id }).sort({ createdAt: -1 }).limit(1);
            if (lOdds.length > 0)
            event_information.marketIds[index].last_odds = lOdds[0]

            
            
          }
          socket.emit('event_info', event_information);
        } else {
          socket.emit('err', 'Event Not Exist');
        }

      }

      socket.join(channel);
    });
  }

  async function takeScores() {
    var url = 'https://livesportscore.xyz:3440/api/bf_scores/'

    try {

      const results = await inPlayEvents.find({ inplay: true }, { Id: 1, _id: 0 });

      var events = [];
      if (results.length > 0) {
        for (let index = 0; index < results.length; index++) {
          if (results[index].Id.length == 8)
            events.push(results[index].Id);
        }

        const response = await axios.get(url + events.join(','));
        const scores = response.data;

        if (scores.length > 0) {

          for (let index = 0; index < scores.length; index++) {
            const score = scores[index];
            io.to('#' + events[index]).emit('score', score);
            const options = {
              upsert: true,
              new: true,
            };

            const item = {
              eventId: events[index],
              data: score
            }

            await Score.findOneAndUpdate({ eventId: events[index] }, item, options);
          }

        }
      } else {
        //console.log('Events emp');
      }
    } catch (error) {
      console.log(error);
    }
  }


  async function eventsBySupportJobs(sportsId) {

    function isValidDate(d) {
      return new Date(d).toString() !== 'Invalid Date';
    }


    var url = `${sportsAPIUrl}/listEventsBySport/${sportsId}`;
    try {
      const response = await axios.get(url);
      var events = response.data;
      if (events.length > 0) {

        events = events.filter(function(item) {
          return isValidDate(item.openDate);
        });

        for (const event of events) {
          const existingDoc = await inPlayEvents.findOne({ Id: event.Id });
        
          if (existingDoc && existingDoc.isCanceled === true) {
            continue;
          }
        
          await inPlayEvents.findOneAndUpdate(
            { Id: event.Id },
            {
              $set: {
                sportsId: sportsId,
                sport: event.sport,
                competitionId: event.competitionId,
                competitionName: event.competitionName,
                Id: event.Id,
                name: event.name,
                countryCode: event.countryCode,
                timezone: event.timezone,
                openDate: Date.parse(event.openDate),
                inplay: false,
                inplayFromServer: event.inplay,
                hasFancy: event.hasFancy,
                status: event.status,
                isPremium: event.isPremium,
                type: event.type,
                matchType: getMatchType(event.competitionName, event.name, sportsId)
              },
            },
            {
              upsert: true,  
            }
          );
          
        }


        var eventIDs = []; 

        for (let index = 0; index < events.length; index++) {
          eventIDs.push(events[index].Id);
        }

        var allIDS = [];
        const currentEvents = await inPlayEvents.find({ status: 'OPEN', sportsId: sportsId+'' }, { Id: 1 });

        for (let i = 0; i < currentEvents.length; i++) {
          allIDS.push(currentEvents[i].Id);
        }

        var diff = allIDS.filter(item => !eventIDs.includes(item));
        // if inplayFromServer is true on old records and not available on last list.
        // update event status with 'CLOSED-INPLAYLIST' 
        // Also update MarketIDs
        for (let i = 0; i < diff.length; i++) {
          console.log('Event is closed because it not exists on listEventsBySport: ' + diff[i]);
          await MarketIDS.updateMany({ eventId: diff[i] }, { $set: { inPlay: false, status: 'CLOSED' } });
          await inPlayEvents.updateOne({ Id: diff[i] }, { $set: { status: 'CLOSED-EVENTLIST', inplay: false, inplayFromServer: false } });
          io.emit('inplay', { eventID: diff[i], inplay: false });
        }


        


        return ({
          success: true,
          message: 'Events retrieved and saved successfully',
          events: events,
        });
      } else {
        return ({
          success: false,
          message: 'Events empty',
        });
      }
    } catch (error) {
      console.log('Problem on taking event list');
      console.error(error);
      return ({
        success: false,
        message: 'Failed to get or save events',
        error: error.message,
      });
    }
  };


  async function listMarketsByCronJob(eventId, sportID) {
    var url = `${sportsAPIUrl}/listMarkets/${eventId}`;
    try {
      const response = await axios.get(url);
      const marketsData = response.data;
      if (marketsData.length > 0) {
        let marketIds = [];
        marketsData.forEach(element => {
          marketIds.push({ id: element.marketId, marketName: element.marketName, status: element.status });
        });



        for (let index = 0; index < marketIds.length; index++) {
          var ev = parseInt(eventId);
          const marketID = await MarketIDS.findOne({ eventId: ev, marketId: marketIds[index].id + '' });
          if (!marketID) {
            const newMarket = new MarketIDS({
              eventId: eventId,
              marketId: marketIds[index].id + '',
              marketName: marketIds[index].marketName,
              sportID: sportID,
              status: marketIds[index].status,
              index: index
            });
            await newMarket.save();
          } else {
            await MarketIDS.findOneAndUpdate({ eventId: ev, marketId: marketIds[index].id + '' }, { status: marketIds[index].status });
          }
        }

        await inPlayEvents.findOneAndUpdate(
          { Id: eventId },
          { marketIds: marketIds },
          { upsert: true, new: true }
        );

      }
    } catch (error) {
      console.error(error);
    }
  };

  async function getOddsFromProvider(marketIdsArray) {

    var tempArry = [];
    var tempArryForIDs = [];

    for (let index = 0; index < marketIdsArray.length; index++) {
      const el = marketIdsArray[index];
      tempArry.push({ market: el.marketId, eventId: el.eventId, indexID: el.index });
      tempArryForIDs.push(el.marketId);
    }


    const all_ids = tempArryForIDs.join(',');

    var url = `${sportsAPIUrl}/odds/?ids=${all_ids}`;
    axios.get(url).then(async (response) => {
      const oddsData = response.data;
      let sportIds = { "soccer": "1", "cricket": "4", "tennis": "2" }
      if (oddsData.length > 0) {

        try {
          for (let index = 0; index < oddsData.length; index++) {
            const element = oddsData[index];



            if (typeof element.Runners !== undefined) {
              if (
                element.Runners[0]?.ExchangePrices.AvailableToLay.length > 0 ||
                element.Runners[0]?.ExchangePrices.AvailableToBack.length > 0 ||
                element.Runners[1]?.ExchangePrices.AvailableToLay.length > 0 ||
                element.Runners[1]?.ExchangePrices.AvailableToBack.length > 0 ||
                element.Runners[2]?.ExchangePrices.AvailableToLay.length > 0 ||
                element.Runners[2]?.ExchangePrices.AvailableToBack.length > 0
              ) {
                var json = {
                  sportsId: sportIds[element.sport],
                  runners: element.Runners,
                  marketId: element.MarketId,
                  isMarketDataDelayed: element.IsMarketDataDelayed,
                  status: element.Status,
                  eventId: element.eventId,
                  isInplay: element.IsInplay,
                  numberOfRunners: element.NumberOfRunners,
                  numberOfActiveRunners: element.NumberOfActiveRunners,
                  totalMatched: element.TotalMatched,
                  createdAt: new Date().getTime()
                };

                if (element.Status != 'OPEN') {
                  await MarketIDS.updateOne({ marketId: tempArryForIDs[index] }, { inPlay: false, status: element.Status });
                }

                var el = new Odds(json);
                el.save();

                const ix = _.findIndex(tempArry, function(o) { return o.market == element.MarketId; });

                if (ix != -1 && tempArry[ix].indexID == 0) {
                  io.to('homepage').emit('odds', { marketId: element.MarketId, data: el, eventId: element.eventId, status: 'NewOddsHomepage' });
                }
                


                io.to('#' + tempArry[index].eventId).emit('odds', { marketId: element.MarketId, data: el, eventId: element.eventId, status: 'NewOdds' });

              } else {

                /*
                var json = {
                  eventId: marketIdsArray[index].eventId,
                  marketId: tempArry[index].market,
                  status: 'CLOSED'
                };
                var el = new Odds(json);
                io.emit('odds', json);
                await MarketIDS.updateOne({ marketId: tempArryForIDs[index] }, { inPlay: false, status: 'RUNNERS NOT EXIST' });
                */
              }
            } else {
              //await MarketIDS.updateOne({ marketId: tempArryForIDs[index] }, { inPlay: false, status: 'ODDS NOT EXIST' });
            }
          }
        } catch (error) {
          console.log(error);

        }


      }
    }, (error) => {
      console.log(error);
    });
  };

  /*
  Checking In play for set inplayFromServer and close the event.
  */
  async function checkInPlay(sportID) {
    var url = `${sportsAPIUrl}/listInplayEvents/${sportID}`;
    try {
      axios.get(url).then(async (response) => {



        // Take last inplay list for events

        const marketsData = response.data;
        var eventIDs = [];
        if (marketsData.length > 0) {
          for (let i = 0; i < marketsData.length; i++) {
            const event = marketsData[i];
            eventIDs.push(event.Id);
            //update this events inplay status with data that was come from data provider.
            await inPlayEvents.updateOne({ Id: event.Id }, { inplayFromServer: true, status: event.status });
          }
        } else {
          console.log('List Empty');
          return;
        }


        // check old inplayFromServer true record. Match with new list.
        var allIDS = [];
        const currentEvents = await inPlayEvents.find({ inplayFromServer: true, sportsId: sportID + '' }, { Id: 1 });

        for (let i = 0; i < currentEvents.length; i++) {
          allIDS.push(currentEvents[i].Id);
        }

        var diff = allIDS.filter(item => !eventIDs.includes(item));
        // if inplayFromServer is true on old records and not available on last list.
        // update event status with 'CLOSED-INPLAYLIST' 
        // Also update MarketIDs
        for (let i = 0; i < diff.length; i++) {

          console.log('Event is closed because it not exists on inplaylist: ' + diff[i]);
          await MarketIDS.updateMany({ eventId: diff[i] }, { $set: { inPlay: false, status: 'CLOSED' } });
          await inPlayEvents.updateOne({ Id: diff[i] }, { $set: { status: 'CLOSED-INPLAYLIST', inplay: false, inplayFromServer: false } });
          io.emit('inplay', { eventID: diff[i], inplay: false });
        }



      }, (error) => {
        console.log(error);
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function setInplay(sportsId) {

    try {
      const markets = await MarketIDS.find({ inPlay: true, sportID: sportsId, status: 'OPEN' }).exec();


      //check current active inplaying MarketIDS
      if (markets.length > 19) {
        console.log('Inplay Events is Full');
        return;
      }

      var count = markets.length;


      // Take list of inplay Event. If this event have new marketids that is added after the match start. Add this marketids to checking list.
      const inPlayEventsDocs = await inPlayEvents.find({ inplay: true, sportsId: sportsId + '', }, 'Id').sort({ openDate: 1 });
      const eventIds = inPlayEventsDocs.map(doc => doc.Id);
      const marketIDsPlaying = await MarketIDS.find({
        eventID: { $in: eventIds },
        status: 'OPEN',
        inPlay: { $ne: true }
      }).sort({ index: 1 });
      if (marketIDsPlaying.length > 0) {
        for (let x = 0; x < marketIDsPlaying.length; x++) {
          const market = marketIDsPlaying[x];
          await MarketIDS.updateOne({ _id: market._id }, { inPlay: true }).exec();;
          console.log(market.marketId + ' market updated with inplay');
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
        isShowed: true,
      };




      var events = await inPlayEvents.find(query)
        .sort({ openDate: 1 })
        .limit(10)
        .exec();




      if (events.length == 0) {
        const queryPastEvents = {
          inplayFromServer: true,
          sportsId: sportsId + '',
          isShowed: true,
          status: 'OPEN',
          inplay: { $ne: true }
        };
        events = await inPlayEvents.find(queryPastEvents)
          .sort({ openDate: -1 })
          .limit(10)
          .exec();
      }


      for (let index = 0; index < events.length; index++) {
        const event = events[index];
        // Before the set inplay true
        // We are taking last marketIDs record from data provider.

        await listMarketsByCronJob(event.Id, event.sportsId);

        //if we have active marketIDS, we are add these marketIds to check list.
        const marketIDs = await MarketIDS.find({ eventId: event.Id, status: 'OPEN' }).sort({ index: 1 });
        if (marketIDs.length > 0) {
          console.log(event.name + ' event updated with inplay');
          await inPlayEvents.updateMany({ Id: event.Id }, { inplay: true }).exec();;
          io.emit('inplay', { eventID: event.Id, inplay: true });
          for (let x = 0; x < marketIDs.length; x++) {
            const market = marketIDs[x];
            await MarketIDS.updateOne({ _id: market._id }, { inPlay: true }).exec();;
            console.log(market.marketId + ' market updated with inplay');
            count++;
            console.log(count);
            if (count > 19) {
              break;
            }
          }
          if (count > 19) {
            break;
          }
        } else {
          //If this event not have to marketIDS, we update the status of event with CLOSED.
          await MarketIDS.deleteMany({ eventId: event.Id }).exec();;
          console.log(event.Id + ' was closed. MarketIDS is empty');
          //await inPlayEvents.updateOne({ Id: event.Id }, { inPlay: false, status: 'CLOSED-MARKETIDS' });
        }



      }

    } catch (error) {
      console.error(error);
    }
  }
}




function getMatchType(competitionName, name, sportsId) {
  const keywords = /(T20|Twenty20|ODI|One Day|T10|Ten10|Test)/i;
  if (sportsId == '4') {
    const nameMatch = name.match(keywords);
    const competitionNameMatch = competitionName && competitionName.match(keywords);

    if (nameMatch) {
      return nameMatch[0];
    } else if (competitionNameMatch) {
      return competitionNameMatch[0];
    }
  }
  return '';
}