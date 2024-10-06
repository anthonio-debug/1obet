
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
    var amount = null
    runnerPosition?.forEach(winner => {
        if (winner.runner == selectionId) {
            amount=winner.amount
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

    getAmountOfWinner
}