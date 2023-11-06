"use strict";

const AsianOdds = require("../../../app/models/asiantableOdds");
const AsianTable = require("../../../app/models/asianTable");
const axios = require("axios");

module.exports = apiRequests;
let io;
let apiURL = "https://betfairoddsapi.com:3445/api";

const tableNames = [
  {
    tableId: "teen20",
    tableName: "Teen Patti 2020(TP2020)",
    imageUrl: "Teen_Patti_2020.png",
  },
  {
    tableId: "teen9",
    tableName: "TEST TEENPATTI(TEST TEENPATTI)",
    imageUrl: "TEST_TEENPATTI.png",
  },
  { tableId: "lucky7", tableName: "LUCKY 7-A", imageUrl: "LUCKY_7-A.jpg" },
  { tableId: "lucky7eu", tableName: "LUCKY 7-B", imageUrl: "LUCKY_7-B.png" },
  { tableId: "card32eu", tableName: "32 CARD-B", imageUrl: "32_CARD-B.png" },
  {
    tableId: "aaa",
    tableName: "AMAR AKBAR ANTHONY(AAA)",
    imageUrl: "AMAR_AKBAR_ANTHONY(AAA).png",
  },
  { tableId: "ab20", tableName: "ANDAR BAHAR", imageUrl: "ANDAR_BAHAR.jpg" },
  { tableId: "abj", tableName: "ANDAR BAHAR 2", imageUrl: "ANDAR_BAHAR_2.png" },
  { tableId: "worli", tableName: "WORLI MATKA", imageUrl: "ANDAR_BAHAR_2.png" },
];

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
    console.log("Socket connect");

    socket.on("join", async (channel) => {
      if (!channel) {
        return socket.emit("err", "Channel Required");
      }

      if (channel.length == 0) {
        return socket.emit("err", "Channel Required");
      }
      socket.join(channel);
    });
  }

  async function getOddsFromProvider() {
    try {
      const asianTb = await AsianTable.find();
      let apiArray = [];
      let resultArray = [];
      let rResultArray = [];
      if (asianTb.length == 0) {
        await AsianTable.insertMany(tableNames);
      }

      for (let i = 0; i < tableNames.length; i++) {
        let url = `${apiURL}/d_rate/${tableNames[i].tableId}`;
        apiArray.push(axios.get(url));
      }

      const apiResult = await Promise.all(apiArray);

      for (let i = 0; i < tableNames.length; i++) {
        if (apiResult[i].data.data) {
          const roundId = apiResult[i].data.data.t1[0].mid;
          let resultUrl = `${apiURL}/r_result/${tableNames[i].tableId}/${roundId}`;
          const rResult = await axios.get(resultUrl);

          const asiaOdd = {
            tableId: tableNames[i].tableId,
            t1: apiResult[i].data.data.t1,
            t2: apiResult[i].data.data.t2,
            gstatus: apiResult[i].data.data.t2[0].gstatus,
            result: rResult.data.data,
            roundId: roundId,
          };
          const updateOdd = AsianOdds.findOneAndUpdate(
            { tableId: asiaOdd.tableId },
            asiaOdd,
            { upsert: true }
          );
          resultArray.push(updateOdd);
        }
      }

      await Promise.all(resultArray);
    } catch (err) {
      console.log(err);
    }
  }
}
