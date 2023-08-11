const axios   = require('axios');
const config  = require('config');
// require('./db');
async function name() {
  const selectionId = 46636793;
  const market = 1.216943899
  const url = `http://136.244.77.249:33333/odds/?ids=${market}`;
  const response = await axios.get(url);
  const oddsData = response.data;
  
  
  // console.log("oddsData Runners ====== ", oddsData);
  if (oddsData.length == 0) {
    console.log(`Match odds not found for sports ID`);
    // return res.status(404).send({ message: `Bet mis match` });
  }
  
  console.log('oddsData runners =========== ', oddsData[0]?.runners);
  // console.log('selectionId ========= ', selectionId);
  
  const runnerFromAPI = oddsData[0].runners.find((runner) => {
    return runner.selectionId == selectionId
  });
  console.log('matchOdds runners ====== ', runnerFromAPI);
}
name()