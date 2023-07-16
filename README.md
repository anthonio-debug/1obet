# BET99

# dafault COMPANY

 db.users.insertOne({ 
    "userName" : "company2", 
    "password" : "$2b$10$6oFX6hlqmtClXtnPyWHhmOC3lvVlARKCpAG7dBC5.vmlqj6ueb7jy", "reference" : "company2", 
    "phone" : "03056959889",  
    "role" : "0",
    "isActive" : true,
    "status" : 1,
    "notes" : "this is note",
    "userId" : 1021, 
    "passwordChanged" : false, 
    "balance" : 5000000000,
    "isDeleted":false,
    "clienPL":5000000000,
    "credit":5000000000,
    "creditLimit":5000000000, 
    "createdAt" : 1678044562.685, 
    "updatedAt" : 1678044562.685, 
    "downLineShare":100 
})

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

default betlimits for company
db.betlimits.insertMany([
{
"_id" : ObjectId("64623bc234ad06204d412beb"),
"name" : "soccer",
"maxAmount" : 280000
},
{
"_id" : ObjectId("64623bc234ad06204d412bec"),
"name" : "cricket",
"maxAmount" : 50000
},
{
"_id" : ObjectId("64623bc234ad06204d412bed"),
"name" : "fancy",
"maxAmount" : 200000
},
{
"_id" : ObjectId("64623bc234ad06204d412bee"),
"name" : "races",
"maxAmount" : 200000
},
{
"_id" : ObjectId("64623bc234ad06204d412bef"),
"name" : "casino",
"maxAmount" : 50000
},
{
"_id" : ObjectId("64623bc234ad06204d412bf0"),
"name" : "greyHound",
"maxAmount" : 50000
},
{
"_id" : ObjectId("64623bc234ad06204d412bf1"),
"name" : "bookMaker",
"maxAmount" : 2000000
},
{
"_id" : ObjectId("64623bc234ad06204d412bf2"),
"name" : "iceHockey",
"maxAmount" : 5000000
},
{
"_id" : ObjectId("64623bc234ad06204d412bf3"),
"name" : "snooker",
"maxAmount" : 5000000
},
{
"_id" : ObjectId("64623bc234ad06204d412bf4"),
"name" : "kabbadi",
"maxAmount" : 5000000
}
])
