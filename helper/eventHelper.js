const {listMarketCatalogue} = require("./SBApiHelper");
const config = require("../config/default.json");
const MarketIDS = require("../app/models/marketIds");
const inPlayEvents = require("../app/models/events");
const {SPORT_SOCCER, SPORT_TENNIS, SPORT_CRICKET} = require('./constants')

const fetchMarket = async (eventId) => {
  try {
    const marketsData = await listMarketCatalogue(eventId);
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

      if ((sportID === SPORT_SOCCER && ["Match Odds", "Over/Under 0.5 Goals", "Over/Under 1.5 Goals", "Over/Under 2.5 Goals", "Over/Under 3.5 Goals", "Over/Under 4.5 Goals", "Over/Under 5.5 Goals"].includes(market.marketName)) ||
        (sportID === SPORT_TENNIS && market.marketName === "Match Odds") ||
        (sportID === SPORT_CRICKET && ["Match Odds", "Tied Match", "To Win the Toss"].includes(market.marketName))) {
        marketIds.push({
          id: market.marketId,
          marketName: market.marketName,
          status: marketStatus,
          runners
        });
      }
    });

    await processMarketIds(eventId, marketIds);
  } catch (err) {
    return {
      success: false,
      message: "Failed to get listMarketsByCronJob",
      error: err.message,
    };
  }
};

const processMarketIds = async (eventId, marketIds) => {
  for (let index = 0; index < marketIds.length; index++) {
    let ev = parseInt(eventId);
    const marketID = await MarketIDS.findOne({ eventId: ev, marketId: marketIds[index].id + "" });

    if (!marketID) {
      await handleNewMarket(eventId, marketIds[index], index);
    } else {
      await MarketIDS.findOneAndUpdate(
        { eventId: ev, marketId: marketIds[index].id + "" },
        { status: marketIds[index].status }
      );
    }
  }

  await inPlayEvents.findOneAndUpdate({ Id: eventId }, { marketIds });
};

const handleNewMarket = async (eventId, market, index) => {
  const countOfMarket = await MarketIDS.countDocuments({ eventId: eventId, status: "OPEN" });

  const allowedCount = sportID === SPORT_SOCCER ? config.soccerEventsAllowedCount :
    sportID === SPORT_TENNIS ? config.tennisEventsAllowedCount :
      sportID === SPORT_CRICKET ? config.cricketEventsAllowedCount :
        config.allSportsEventsAllowedCount;

  if (countOfMarket > allowedCount) return;

  const newMarket = new MarketIDS({
    eventId,
    marketId: market.id + "",
    marketName: market.marketName,
    sportID,
    totalMatched: market.totalMatched,
    status: market.status,
    index,
    runners: market.runners,
    inPlay: true
  });
  await newMarket.save();
};

module.exports = {fetchMarket}
