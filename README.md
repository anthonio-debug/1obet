# BET99

# dafault COMPANY

# db.users.insertOne({ "id" : ObjectId("6404ed9275e7e9deeee1f144"), "userName" : "Company", "password" : "$2b$10$6oFX6hlqmtClXtnPyWHhmOC3lvVlARKCpAG7dBC5.vmlqj6ueb7jy", "reference" : "Company", "phone" : "03056959889", "token" : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjAsImNyZWF0ZWRCeSI6IjAiLCJyb2xlIjoiMCIsImlhdCI6MTY3ODA0NDU2Mn0.G1SLh0YaoDacHtbf6-J_0gOK83m5rC1LWHHdvlm5UOA","role" : "0","isActive" : true,"status" : 1,"notes" : "this is note","userId" : 0, "passwordChanged" : false, "balance" : 5000000000, "createdBy" : "0","parentId":"0","isDeleted":false,"clienPL":5000000000,"credit":5000000000,"creditLimit":5000000000, "createdAt" : 1678044562.685, "updatedAt" : 1678044562.685, "downLineShare":100,"v" : 0 })

# "password":"Company@123"

# "userName" : "Company"

default theme and login page for company
db.settings.insertMany([
{
"_id" : ObjectId("645e20c8023e705fdc7edad2"),
"defaultLoginPage" : "login-page-one",
"createdAt" : 1683894409.774,
"updatedAt" : 1683894409.774
},
{
"_id" : ObjectId("645e239b023e705fdc7edad4"),
"defaultThemeName" : "grey-theme",
"createdAt" : 1683894409.774,
"updatedAt" : 1683894409.774
}])

default maxbetsizes for company

db.maxbetsizes.insertMany([{
"_id" : ObjectId("645f8016b9bfff0edb6317e7"),
"soccer" : 250000,
"tennis" : 250000,
"cricket" : 5000,
"fancy" : 200000,
"races" : 200000,
"casino" : 50000,
"greyHound" : 50000,
"bookMaker" : 2000000,
"iceHockey" : 5000000,
"snooker" : 5000000,
"kabbadi" : 5000000,
"userId" : 0
}]);
