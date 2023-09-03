#!/bin/bash

# İlk koleksiyon için veritabanına bağlan ve belirli bir tarihten eski belgeleri sil
mongosh "mongodb://localhost:27017/Bet99" --eval 'db.raceodds.deleteMany({ createdAt: { $lt: new Date().getTime() - 20 * 60 * 1000 } })'

# İkinci koleksiyon için veritabanına bağlan ve belirli bir tarihten eski belgeleri sil
mongosh "mongodb://localhost:27017/Bet99" --eval 'db.odds.deleteMany({ createdAt: { $lt: new Date().getTime() - 20 * 60 * 1000 } })'

# Üçüncü koleksiyon için veritabanına bağlan ve belirli bir tarihten eski belgeleri sil
mongosh "mongodb://localhost:27017/Bet99" --eval 'db.collectionThree.deleteMany({ created: { $lt: new ISODate(new Date(new Date().getTime() - 20 * 60 * 1000).toISOString()) }  })'
