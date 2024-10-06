

function getAmountOfWinner(bet, selectionId) {
  
    const runnerPosition = bet?.runnersPosition
    var amount = null
    runnerPosition?.forEach(winner => {
        if (winner.runner == selectionId) {
            amount=winner.amount
        }
    });
    console.log("amountttttttttttttttttttttt AK-------------------",amount)
    console.log("userIDdddddddddddddddddddddddddddd AK-------------------",bet.userId)
    if(amount<0)
        console.log("You have lost by...........................>",amount);
    if(amount>0)
        console.log("You have won by...........................>",amount);
    if(amount==0)
        console.log("You have lost by...........................>",amount);
}
module.exports = {
   
    getAmountOfWinner
}