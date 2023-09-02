'use strict';
module.exports = ToolForFancy;


const axios = require('axios');

const inPlayEvents = require('../../app/models/events');
const FancyEvent = require('../../app/models/fancyEvent');
const FancyOdds = require('../../app/models/fancyOdds');

let io;
const fancyUrl = 'https://betfairoddsapi.com:3443/api';
function ToolForFancy() {
    return { init };

    async function init(_io, express) {

        io = _io;

        setInterval(getList, 20 * 60 * 1000);
        setInterval(getFancyOdds, 1 * 1000);
        setInterval(removeOdds, 60 * 60 * 1000);

        getList();
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
            var marketIds = [];
            var processArray = [];
            var events = await inPlayEvents.find({ sportsId: '4', inplay: true, hasFancy:true }, { Id: 1 }).exec();

            for (let index = 0; index < events.length; index++) {
                const event = events[index];
                marketIds.push(event.Id);
                processArray.push(event.Id);
            }

            //console.log(processArray.join(','));

            if (processArray.length > 0) {
                const url = `${fancyUrl}/bm_fancy_multi/` + processArray.join(',');
                const response = await axios.get(url);
                const facyOdds = response.data;
                var index = 0;
                if (facyOdds) {
                    for (var key in facyOdds) {

                       // console.log(facyOdds, key);

                        if (facyOdds.hasOwnProperty(key)) {
                            try {
                                var odd = facyOdds[key];

                                if (odd && odd.data && odd.data.t3 &&  odd.data.t3.length > 0) {
                                    odd.data.t3 = odd.data.t3.sort((a, b) => {
                                        return a.nat.localeCompare(b.nat);
                                        });
                                }
                                if (odd.gameId) {
                                    var newFancyOdds = new FancyOdds({
                                        eventId: odd.gameId,
                                        marketId: key,
                                        data: odd,
                                    });
                                    await newFancyOdds.save();
                                    
                                    io.to('#' + odd.gameId).emit('fancy_odds', newFancyOdds);
                                }

                            } catch (error) {

                                console.log(processArray);
                                console.log(marketIds);
                                console.log(index);
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
        const { marketId, ...restOfData } = eventData;

        try {
            await FancyEvent.findOneAndUpdate(
                { marketId: marketId },
                { ...restOfData, marketId: marketId },
                {
                    upsert: true,
                    new: true
                } 
            );
            console.log("Event successfully added or updated.");
        } catch (error) {
            console.error("Error adding or updating event:", error);
        }
    }

    function removeOdds () {
        const oneHourAgo = new Date().getTime() - 60 * 60 * 1000;
        FancyOdds.deleteMany({ created: { $lt: oneHourAgo } }, (err) => {
          if (err) {
            console.error("Error while deleting documents:", err);
            return;
          }
          console.log("Documents older than 1 hour have been deleted.");
        });
    }




}