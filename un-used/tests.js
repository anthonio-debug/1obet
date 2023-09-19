// const axios = require('axios');
const id = 1.218374208
const multipeResponse = [];
// make Sure No More Records Then 4 
for (let i = 1; i < 5; i++) {
  setTimeout( async () => {      
    const url = `http://209.250.242.175:33332/odds/?ids=${id}`;
    const response = await fetch(url);
    // const response = await axios.get(url);
    const oddsData = response.data;
    console.log(oddsData);
    multipeResponse.push(oddsData)
  }, 1000*i);  
}


setTimeout(() => {
  console.log("  ==== ", multipeResponse);
}, 5000);











// const runnersPosition = [
//     { runner: 9187513, amount: 11000 },
//     { runner: 24823398, amount: -3000 },
//     { runner: 45528849, amount: 7000 },
//     { runner: 52322150, amount: -3001 },
//     { runner: 37459730, amount: -3000 },
//     { runner: 47883568, amount: 850 }
//   ];
  
//   const lowestValue = runnersPosition.reduce((min, current) => {
//     return current.amount < min.amount ? current : min;
//   }, runnersPosition[0]);

//   console.log(" =============== lowestValue ================= ", lowestValue);