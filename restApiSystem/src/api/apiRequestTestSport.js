"use strict";

const axios = require("axios");
const TestSportOdd = require("../../../app/models/TestSport");

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
        const marketIds = "1.221964395,1.221964397"
        const response = await axios.get(`${apiURL}/${marketIds}`)
        if(response.data.result.length > 0) {
            for (let i = 0; i < response.data.result.length; i++) {
                const odd = {
                    eventId: "32843849",
                    marketId: response.data.result[i].marketId,
                    runners: response.data.result[i].runners
                }
                const addNewSport = await TestSportOdd.findOneAndUpdate({marketId: response.data.result[i].marketId}, odd, {upsert: true})
                resultArray.push(addNewSport)
            }
            
            const oddsData = await TestSportOdd.find()
            io.emit("testSports", oddsData)
        }
        
        await Promise.all(resultArray);
      } catch (err) {
        console.log(err);
      }
    }
  }