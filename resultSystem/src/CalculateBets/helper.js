

function getAmountOfWinner(source) {
    console.log("source::::::::::::::::::::::",source);
  let amount = 20;
    console.log("amountttttttttttttttttttttt AK-------------------",amount)
    console.log("userIDdddddddddddddddddddddddddddd AK-------------------",3232323)
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