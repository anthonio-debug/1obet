const Bets = require('../../../app/models/bets');
const Deposits = require('../../../app/models/deposits');
const ExpRec = require('../../../app/models/ExpRec');
const MarketIDS = require('../../../app/models/marketIds');
const Events = require('../../../app/models/events');
const User = require('../../../app/models/user');
const config = require('config');

const Session = require('../../../app/models/Session');
const CurrentPosition = require('../../../app/models/CurrentPosition');

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
    getParents,
    handleLosingCasinoBet,
    handleWinningCasinoBet,
    handleLosingBetCheck,
    getAmountOfWinner
}