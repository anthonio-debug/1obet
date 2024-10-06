
function getAmountOfWinner(bet, selectionId) {
    console.log("Reached inside the function..............................");
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