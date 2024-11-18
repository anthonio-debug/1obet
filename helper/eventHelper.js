const {listMarketCatalogue} = require("./api/SBApiHelper");
const config = require("../config/default.json");
const MarketIDS = require("../app/models/marketIds");
const raceMarkets = require('../app/models/raceMarkets')
const inPlayEvents = require("../app/models/events");
const {SPORT_SOCCER, SPORT_TENNIS, SPORT_CRICKET} = require('./constants')

const fetchMarket = async (event) => {

  const eventId = event.Id
  const sportsId = event.sportsId
  try {
    await inPlayEvents.updateMany(
      {Id: eventId},
      {$set: {lastCheckMarket: Date.now()}}
    );
    console.log("eventId=-=-=-=-=-=-=-=-=-= eventId",eventId);
    const marketsData = await listMarketCatalogue(eventId);
    
    
    //console.log("marketsData=-=-=-=-=-=-=-=-=-= marketsData...........", marketsData);
    if (!marketsData.length) return;
    const marketsk = await MarketIDS.findOne({eventId:eventId});
    
    const eventDetail = await inPlayEvents.findOne({ Id: eventId });
    let marketStatus = 'PENDING';
    let marketIds = [];

    console.log("marketsData.............3.......................................",marketsData);
    if(eventDetail.sportsId=='7' || eventDetail.sportsId == '4339'){
      const eventsData = marketsData;
      let marketIds = [];
      // Create an instance of the raceMarkets model
      for (let j = 0; j < eventsData.length; j++) {
        console.log("eventsData[j]?.description?.marketType---------------------------------",eventsData[j]?.description?.marketType);
        if (eventsData[j]?.description?.marketType === "WIN") {
        // if (eventsData[j]?.description?.marketType) {
          marketIds.push(eventsData[j].marketId);
          console.log("eventsData[j].marketId...................................",eventsData[j].marketId);
          await raceMarkets.findOneAndUpdate(
            {
              marketId: eventsData[j].marketId,
              eventTypeId: eventsData[j].eventType.id,
              "eventNodes.eventId": eventsData[j].event.id,
              "eventNodes.event.eventName": eventsData[j].event.name,
              "eventNodes.event.countryCode": eventsData[j].event.countryCode,
            },
            {
              $set: {
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
                      status: "PENDING"
                    },
                    description: {
                      marketName: eventsData[j].marketName,
                      marketTime: new Date(eventsData[j].marketStartTime),
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
              }
            }, {upsert: true, new: true}
          );
          let runners = [];
          for (let ix1 = 0; ix1 < eventsData[j].runners.length; ix1++) {
            const runner = eventsData[j].runners[ix1];
            runners.push({SelectionId: runner.selectionId, runnerName: runner.runnerName});
          }
          console.log("eventsData[j].marketId..............................................",eventsData[j].marketId);
          await MarketIDS.findOneAndUpdate(
            {
              marketId: eventsData[j].marketId,
              sportID: eventsData[j].eventType.id,
              eventId: eventId,
            },
            {
              $set: {
                runners: runners,
                marketName: eventsData[j].marketName,
                marketType: eventsData[j]?.description?.marketType,
                status: 'OPEN',
                openDate: Date.parse(eventsData[j].marketStartTime)
              }
            }, {upsert: true, new: true});
        }
      }

      await inPlayEvents.findOneAndUpdate(
        {Id: eventId},
        {$set: {marketIds: marketIds}},
        {upsert: true, new: true});
    }else{
      console.log("-------------------------------------other sports..............");
      marketsData.forEach((market) => {
        if (config.activeProvider === 'old') {
          marketStatus = market.status;
        }
  
        const runners = market.runners?.map(runner => ({
          SelectionId: runner?.selectionId,
          runnerName: runner?.runnerName,
        }));
        console.log("-----------------------market.marketName-----------------",market.marketName);
        if ((sportsId === SPORT_SOCCER && ["Match Odds", "Over/Under 0.5 Goals", "Over/Under 1.5 Goals", "Over/Under 2.5 Goals"].includes(market.marketName)) ||
          (sportsId === SPORT_TENNIS && market.marketName === "Match Odds") ||
          (sportsId === SPORT_CRICKET && ["Match Odds", "Tied Match", "To Win the Toss"].includes(market.marketName))) {
  
            //console.log("DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD DATE::::::",market.marketStartTime);
              //console.log("PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP DATE::::::",Date.parse((market.marketStartTime)));
          marketIds.push({
            id: market.marketId,
            marketName: market.marketName,
            openDate:Date.parse((market.marketStartTime)),
            status: marketStatus,
            runners
          });
        }else{
          marketIds.push({
            id: market.marketId,
            marketName: market.marketName,
            openDate:Date.parse((market.marketStartTime)),
            status: marketStatus,
            runners
          });
         // console.log("Markets for races......................");
        }
      });
  
      await processMarketIds(eventId, marketIds, sportsId);
    }


  } catch (err) {
    return {
      success: false,
      message: "Failed to get listMarketsByCronJob",
      error: err?.message,
    };
  }
};

const processMarketIds = async (eventId, marketIds, sportsId) => {
  for (let index = 0; index < marketIds.length; index++) {
    const market = marketIds[index]
    const marketID = await MarketIDS.findOne({ eventId: eventId, marketId: `${market.id}` });


    if (!marketID) {
      //console.log("Handling new markets11111111111...................................................................",marketID);
      await handleNewMarket(eventId, market, index, sportsId);
    } else {
      //console.log("Handling prev markets222222222222...................................................................",marketID);
      await MarketIDS.findOneAndUpdate(
        { eventId: eventId, marketId: `${market.id}` },
        { status: market.status, sportID: Number(sportsId), }
      );
    }


  }

  await inPlayEvents.findOneAndUpdate({ Id: eventId }, { marketIds });
};

const handleNewMarket = async (eventId, market, index, sportsId) => {
 // console.log("Handling new markets...................................................................");
  const countOfMarket = await MarketIDS.countDocuments({ eventId: eventId, status: "OPEN" });

  const allowedCount = sportsId === SPORT_SOCCER ? config.soccerEventsAllowedCount :
    sportsId === SPORT_TENNIS ? config.tennisEventsAllowedCount :
      sportsId === SPORT_CRICKET ? config.cricketEventsAllowedCount :
        config.allSportsEventsAllowedCount;

  if (countOfMarket > allowedCount) return;
if(market.marketName === 'Match Odds' ||
  market.marketName === 'Over/Under 0.5 Goals' ||
  market.marketName === 'Over/Under 1.5 Goals' ||
  market.marketName === 'Over/Under 2.5 Goals' ){
    const newMarket = new MarketIDS({
      eventId,
      marketId: market.id + "",
      marketName: market.marketName,
      sportID: Number(sportsId),
      totalMatched: market.totalMatched,
      status: market.status,
      openDate: market.openDate,
      index,
      runners: market.runners,
      inPlay: true
    });
    await newMarket.save();
    if(sportsId==7 || sportsId == 4339){
      
    }
  }
  


};

module.exports = {fetchMarket}
