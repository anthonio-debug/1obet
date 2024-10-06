const Bets = require('../../../app/models/bets');
function getAmountOfWinner(bet, selectionId) {
    console.log("Reached inside the function..............................");

    const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

let calculatedExp = 0;
const userId = bet.userId;
let TotalWin = 0;
let TotalLose = 0;

    const runnerPosition = bet?.runnersPosition
    var amount = 0
    var winnerRunner = '';
    runnerPosition?.forEach(winner => {
        console.log("Winner amount for ",winner.runner,"----------------------------------------->",winner.amount);
        if (winner.runner == selectionId) {
            amount=winner.amount
            winnerRunner = winner.runner
        }
    });
    if(amount>0){

    }else if(amount<0){

    }else{

    }
    console.log("amountttttttttttttttttttttt AK-------------------",amount)
    console.log("userIDdddddddddddddddddddddddddddd AK-------------------",bet.userId)
return amount 
}
async function getAmountOfWinnerTemp(betId, selectionId) {
    console.log("Reached inside the function..............................");

    const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  const bet = await Bets.findOne({
    _id: betId
  });
let calculatedExp = 0;
const userId = bet.userId;
let TotalWin = 0;
let TotalLose = 0;



  
  console.log("debt insdie...................................",bet);
    const runnerPosition = bet?.runnersPosition
    var amount = 0
    var winnerRunner = '';
    runnerPosition?.forEach(winner => {
        console.log("Winner amount for ",winner.runner,"----------------------------------------->",winner.amount);
        if (winner.runner == selectionId) {
            amount=winner.amount
            winnerRunner = winner.runner
        }
    });
    if(amount>0){

    }else if(amount<0){

    }else{

    }
    console.log("amountttttttttttttttttttttt AK-------------------",amount)
    console.log("userIDdddddddddddddddddddddddddddd AK-------------------",bet.userId)
return amount 
}

module.exports = {

    getAmountOfWinner,
    getAmountOfWinnerTemp
}