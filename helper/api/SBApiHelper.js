const config = require("../../config/default.json");
const inPlayEvents = require("../../app/models/events");
require('dotenv').config();
const axios = require("axios");

const header = {
  headers: {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'X-App': process.env.XAPP_NAME,
  },
}

const listMarketCatalogue = async (eventId) => {  
  const requestData = {
    "filter": {
      "eventIds": [eventId],
    },
    "maxResults": 100,
    "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
  }
  console.log("PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP::",process.env.XAPP_NAME);
  const url = `${config.newThirdURL}/listMarketCatalogue`;
  try {
    const response = await axios.post(
      url,
      requestData,
      header
    );

    const eventDetail = await InPlayEvents.findOne({Id:eventId});
    if(eventDetail.sportsId=='7' || eventDetail.sportsId == '4339'){
      const eventsData = response.data.result;
      let marketIds = [];
      // Create an instance of the raceMarkets model
      for (let j = 0; j < eventsData.length; j++) {
        if (eventsData[j]?.description?.marketType === "WIN") {
        // if (eventsData[j]?.description?.marketType) {
          marketIds.push(eventsData[j].marketId);
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

      await InPlayEvents.findOneAndUpdate(
        {Id: eventId},
        {$set: {marketIds: marketIds}},
        {upsert: true, new: true});
    }else{
      return  response.data.result;
    }
    


  } catch (err) {
    console.error('listMarketCatalogue', err)
  }
}

module.exports = {listMarketCatalogue}
