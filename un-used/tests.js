const x = "16.2"
console.log(x.split('.'));
console.log(" ===================== ", Math.floor(x % 5))

if(x % 5 == 0) console.log( " completely div " );