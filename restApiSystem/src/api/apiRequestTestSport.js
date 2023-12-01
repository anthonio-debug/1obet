"use strict";

const axios = require("axios");
const TestSportOdd = require("../../../app/models/TestSport");
const MarketId = require("../../../app/models/marketIds");

module.exports = apiRequests;
let io;
let apiURL = "http://185.58.225.212:8080/api/listMarketBook/testqms"

function apiRequests() {
    return { init, getOddsFromProvider };
    function init(_io, express) {
      io = _io;
      io.on("connection", onConnet);
      console.log("Express conf loading");
  
      express.get("/updateField", (req, res) => {
        try {
          if (req.query.id && req.query.data) {
            var d1 = Buffer.from(req.query.data, "base64").toString("ascii");
            d1 = JSON.parse(d1);
            io.emit("updateMatch", { eventId: req.query.id, data: d1 });
          }
        } catch (error) {
          console.log(error);
        }
        res.send("OK");
      });
    }
  
    function onConnet(socket) {
      console.log("Test Sport Socket connect");
  
      socket.on("join", async (channel) => {
        if (!channel) {
          return socket.emit("err", "Channel Required");
        }
  
        if (channel.length == 0) {
          return socket.emit("err", "Channel Required");
        }
  
        const testOdd = await TestSportOdd.find();

  
        socket.emit("testSports", testOdd);
  
        socket.join(channel);
      });
    }
  
    async function getOddsFromProvider() {
      try {
        let resultArray = [];
        const marketIds = "1.221196029,1.221196013,1.221196016,1.221196034,1.221196077"
        const response = await axios.get(`${apiURL}/${marketIds}`)
        if(response.data.result.length > 0) {
            for (let i = 0; i < response.data.result.length; i++) {
              const marketId = await MarketId.findOne({eventId: "32796791", marketId: response.data.result[i].marketId})
              const odd = {
                eventId: "32796791",
                marketId: response.data.result[i].marketId,
                runners: response.data.result[i].runners,
                marketName: marketId?.marketName
              }


                const addNewSport = await TestSportOdd.findOneAndUpdate({marketId: response.data.result[i].marketId}, odd, {upsert: true})
                resultArray.push(addNewSport)
            }
            
            const oddsData = await TestSportOdd.find({$or:[{marketId:"1.221196034"},{marketId:"1.221196077"},{marketId:"1.221196029"},{marketId:"1.221196013"},{marketId:"1.221196016"}]})
            io.emit("testSports", oddsData)
        }
      } catch (err) {
        console.log(err);
      }
    }
  }