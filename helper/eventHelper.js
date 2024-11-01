const {listMarketCatalogue} = require("./api/SBApiHelper");
const config = require("../config/default.json");
const MarketIDS = require("../app/models/marketIds");
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
    //console.log("eventId=-=-=-=-=-=-=-=-=-= eventId",eventId);
    const marketsData = await listMarketCatalogue(eventId);
    console.log("marketsData.length....................................................",marketsData.length);
    
   // console.log("marketsData=-=-=-=-=-=-=-=-=-= marketsData...........", marketsData);
    if (!marketsData.length) return;

    let marketStatus = 'PENDING';
    let marketIds = [];


    marketsData.forEach((market) => {
      if (config.activeProvider === 'old') {
        marketStatus = market.status;
      }

      const runners = market.runners?.map(runner => ({
        SelectionId: runner?.selectionId,
        runnerName: runner?.runnerName,
      }));

      if ((sportsId === SPORT_SOCCER && ["Match Odds", "Over/Under 0.5 Goals", "Over/Under 1.5 Goals", "Over/Under 2.5 Goals"].includes(market.marketName)) ||
        (sportsId === SPORT_TENNIS && market.marketName === "Match Odds") ||
        (sportsId === SPORT_CRICKET && ["Match Odds", "Tied Match", "To Win the Toss"].includes(market.marketName))) {

          console.log("DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD DATE::::::",market.marketStartTime);
            console.log("PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP DATE::::::",Date.parse((market.marketStartTime)));
        marketIds.push({
          id: market.marketId,
          marketName: market.marketName,
          openDate:Date.parse((market.marketStartTime)),
          status: marketStatus,
          runners
        });
      }
    });

    await processMarketIds(eventId, marketIds, sportsId);
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
      console.log("Handling new markets11111111111...................................................................",marketID);
      await handleNewMarket(eventId, market, index, sportsId);
    } else {
      console.log("Handling new markets222222222222...................................................................",marketID);
      await MarketIDS.findOneAndUpdate(
        { eventId: eventId, marketId: `${market.id}` },
        { status: market.status, sportID: Number(sportsId), }
      );
    }
  }

  await inPlayEvents.findOneAndUpdate({ Id: eventId }, { marketIds });
};

const handleNewMarket = async (eventId, market, index, sportsId) => {
  console.log("Handling new markets...................................................................");
  const countOfMarket = await MarketIDS.countDocuments({ eventId: eventId, status: "OPEN" });

  const allowedCount = sportsId === SPORT_SOCCER ? config.soccerEventsAllowedCount :
    sportsId === SPORT_TENNIS ? config.tennisEventsAllowedCount :
      sportsId === SPORT_CRICKET ? config.cricketEventsAllowedCount :
        config.allSportsEventsAllowedCount;

  if (countOfMarket > allowedCount) return;

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
};

module.exports = {fetchMarket}
