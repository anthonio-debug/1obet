const express = require('express');
const CasinoGames = require('../models/casinoGames');
const SelectedCasino = require('../models/selectedCasino');
const selectedCasinoValidator = require('../validators/casinoGames');
const { validationResult } = require('express-validator');
const loginRouter = express.Router();
const axios = require('axios');
let config = require('config');
const User = require('../models/user');

async function addCasinoGameDetails(req, res) {
  if( req.decoded.role !== '0' ){
    return res.status(200).send({ message: 'you are not allowed to add games',success:false})
  }
  try {
    const response = await axios.post(config.apiUrl, {
      api_password: config.api_password,
      api_login: config.api_username,
      method: 'getGameList',
      show_additional: true,
      show_systems: 1,
      currency: 'PKR',
    });

    console.log('Response:', response.data);
    const gameList = response.data.response;
    const bulkOps = gameList.map((game) => ({
      updateOne: {
        filter: { category: game.category },
        update: {
          $push: { games: { ...game, details: JSON.parse(game.details) } },
        },
        upsert: true,
      },
    }));

    await CasinoGames.bulkWrite(bulkOps);
    res.send({ success: true, message: 'Casino games added successfully' });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ success: false, message: 'Failed to add casino games' });
  }
}

function getAllCasinoCategories(req, res) {
  CasinoGames.find({}, { _id: 1, category: 1 }, (err, casinoCategories) => {
    if (err || !casinoCategories || casinoCategories.length == 0) {
      return res.status(404).send({ message: 'Casino Categories Not Found' });
    }

    SelectedCasino.find({}, { _id: 1, status: 1 }, (err, selectedCasino) => {
      if (err || !selectedCasino) {
        return res
          .status(404)
          .send({ message: 'Failed to retrieve casino categories' });
      }

      const results = casinoCategories.map((category) => {
        const matchingCategory = selectedCasino.find((selected) =>
          selected._id.equals(category._id)
        );
        const status = matchingCategory ? parseInt(matchingCategory.status) : 0;
        return {
          _id: category._id,
          category: category.category,
          status: status.toString(),
        };
      });

      return res.send({
        message: 'Casino Categories Found',
        success: true,
        results: results,
      });
    });
  });
}

async function addSelectedCasinoCategories(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role == 5) {
    return res
      .status(404)
      .send({ message: 'only company can add selected casino categories' });
  }
  const { casinoCategories } = req.body;

  try {
    for (const category of casinoCategories) {
      const { _id, status, games } = category;

      const allCasino = await CasinoGames.findOne({ _id }).exec();
      let selectedCasino = await SelectedCasino.findOne({ _id }).exec();

      if (!selectedCasino) {
        selectedCasino = new SelectedCasino({
          _id: _id,
          category: allCasino.category,
          status: status,
          games: [],
        });
      }

      if (status == 2) {
        console.log('in here');
        // Add all games for _id in selectedCasino
        selectedCasino._id = _id; // Assign _id
        selectedCasino.category = allCasino.category; // Assign _id
        selectedCasino.status = status; // Assign status
        selectedCasino.games = allCasino.games;
        await selectedCasino.save();
      } else if (status == 1) {
        if (games.length == 0) {
          console.log('Deleting selected casino ->>> :', _id);
          await SelectedCasino.deleteOne({ _id: _id });
        } else {
          for (const gameID of games) {
            let matchingGame = allCasino.games.find(
              (game) => game.id == gameID
            );

            if (matchingGame) {
              console.log('Matching game found:', matchingGame);
              // Check if the game is already present in selectedCasino
              const isGameAlreadyAdded = selectedCasino.games.some(
                (game) => game.id == gameID
              );

              if (!isGameAlreadyAdded) {
                selectedCasino.games.push(matchingGame); // Add the matching game to selectedCasino
              }
              // else {
              //   return res.status(404).send({ message: 'Game already present:' });
              // }
            } else {
              console.log('No matching game found for ID:', gameID);
            }
          }
          await selectedCasino.save();
        }
      }
    }

    for (const category of casinoCategories) {
      const { _id, status } = category;
      if (status == 0) {
        console.log('Deleting selected casino:', _id);
        await SelectedCasino.deleteOne({ _id: _id });
      }
    }

    res.send({
      message: 'Selected casino categories saved successfully',
      success: true,
    });
  } catch (err) {
    console.error('Error saving selected casino categories:', err);
    res
      .status(500)
      .send({ message: 'Failed to save selected casino categories' });
  }
}

function getCategoryCasinoGames(req, res) {
  let _id = req.query._id;
  CasinoGames.findOne({ _id: _id }, (err, casinoCategories) => {
    if (err || !casinoCategories || casinoCategories.length == 0) {
      return res.status(404).send({ message: 'Casino Categories Not Found' });
    }
    SelectedCasino.findOne({ _id: _id }, (err, selectedCategory) => {
      if (err || !selectedCategory || selectedCategory.length == 0) {
        const results = casinoCategories.games.map((game) => {
          return {
            _id: game._id,
            game: game,
            status: 0,
          };
        });
        return res.send({
          message: 'Selected Casino Games Found',
          success: true,
          results: results,
        });
      } else {
        const results = casinoCategories.games.map((game) => {
          const matchingGame = selectedCategory.games.some(
            (selected) => selected.id == game.id
          );
          const status = matchingGame ? 1 : 0;
          return {
            _id: game._id,
            game: game,
            status: status,
          };
        });
        return res.send({
          message: 'Selected Casino Games Found',
          success: true,
          results: results,
        });
      }
    });

    // return res.send({
    //   message: 'Selected Casino Games Found',
    //   success: true,
    //   results: casinoCategories,
    // });
  });
}

function getAllSelectedCasinos(req, res) {
    let query = {};
  
    let page = 1;
    let limit = 20;
    if (req.body.numRecords) {
      if (isNaN(req.body.numRecords))
        return res.status(400).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
      if (req.body.numRecords < 0)
        return res.status(400).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
      limit = Number(req.body.numRecords);
    }
    if (req.body.page) {
      page = Number(req.body.page);
    }
  
  // Check for isMobile parameter in the request body
  if (req.body.isMobile !== undefined) {
    query['games.mobile'] = true;
  } else if (req.body.isMobile === false) {
    query['games.isMobile'] = false;
  }

 // Check for gameCategory parameter in the request body
 if (req.body.gameCategory !== undefined) {
  if (req.body.gameCategory === "All") {
    // query = { "games": { "$elemMatch": {} } }
   } else {
    query['games.category'] = req.body.gameCategory;
  }
}

    SelectedCasino.find(query)
      .select({ _id: 0, __v: 0 })
      .lean()
      .exec((err, data) => {
        if (err) return res.status(500).send({ message: 'USERS_PAGINATION_FAILED' });
  
        const filteredGames = [];
        data.forEach(item => {
          console.log('item',item);
          item.games.forEach(game => {
            if (
              (req.body.isMobile === undefined || game.mobile === req.body.isMobile) &&
              (req.body.gameCategory === undefined || game.category === req.body.gameCategory)
            ) {
              filteredGames.push({
                id: game.id,
                name: game.name,
                image_filled: game.image_filled,
                isDashboard: game.isDashboard,
                isMobile: game.mobile,
                
              });
            }
          });
        });

        // Apply pagination based on the requested number of records
        const totalRecords = filteredGames.length;
        const totalPages = Math.ceil(totalRecords / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = Math.min(startIndex + limit, totalRecords);
        const paginatedGames = filteredGames.slice(startIndex, endIndex);
      SelectedCasino.find({},{category:1,_id:0}, (err, categories) => {
       if(err) return res.send ({message:'category not found'})
        return res.send({
          message: 'Selected Casino Games List',
          success: true,
          results: paginatedGames,
          categories: categories,
          pagination: {
            total: totalRecords,
            totalPages: totalPages,
            currentPage: page,
            recordsPerPage: limit
          }
        });
      });
    })
  }
async function getGame(req, res) {
  try {
    const errors = validationResult(req);
    if (errors.errors.length !== 0) {
      return res.status(400).send({ errors: errors.errors });
    }

    if( req.decoded.role !== '5' ){
      return res.status(200).send({ message: 'you are not allowed to play casino games',success:false})
    }
    const { homeurl, cashierurl, gameid } = req.body;
    const user = await User.findOne({ userId: req.decoded.userId });

    const payload = {
      api_password: config.api_password,
      api_login: config.api_username,
      method: 'getGame',
      lang: config.language,
      user_username: 'user_' + user.userId,
      user_password: 'user_' + user.userId,
      homeurl,
      cashierurl,
      gameid,
      play_for_fun: config.play_for_fun,
      currency: config.currency,
    };

    const response = await axios.post(config.apiUrl, payload);
    res.status(200).send({
      success: true,
      message: 'game data found successfully',
      results: response.data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: 'Failed to get game' });
  }
}


async function getDashboardGames(req, res) {
  const data = await SelectedCasino.find({});
  return res.send({
    message: 'Selected Casino Games List',
    success: true,
    results: data,
  });
}

function getGamesByName(req, res) {
  let category = req.query.category;
  CasinoGames.findOne({ category: category }, (err, casinoCategories) => {
    if (err || !casinoCategories || casinoCategories.length == 0) {
      return res.status(404).send({ message: 'Casino Categories Not Found' });
    }
      return res.send({
        message: 'Category Casino Games Found',
        success: true,
        results: casinoCategories.games,
    });
  });
}

function addSelectedDashboardGames(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.array() });
  }

  if ( req.decoded.role !== '0' ) {
    return res.status(200).send({ message: 'you are not allowed to add dashboard games', success: false })
  }
  const { gameIds } = req.body;

  SelectedCasino.updateMany(
    {},
    { $set: { 'games.$[game].isDashboard': true } },
    { arrayFilters: [{ 'game.id': { $in: gameIds } }], new: true }
  ).then((result) => {
    // Update all other games to isDashboard: false
    SelectedCasino.updateMany(
      {},
      { $set: { 'games.$[game].isDashboard': false } },
      { arrayFilters: [{ 'game.id': { $nin: gameIds } }]}
    ).then(() => {
      return res.send({ success: true, message: 'Selected Dashboard games updated successfully' });
    }).catch((err) => {
      return res.status(500).send({ success: false, message: 'Error updating non-matching games', err });
    });
  }).catch((err) => {
    return res.status(500).send({ success: false, message: 'Error updating selected games', err });
  });
}

function getSelectedGamesBySearch(req, res) {
  let query = {};

  let page = 1;
  let limit = 20;
  if (req.body.numRecords) {
    if (isNaN(req.body.numRecords))
      return res.status(400).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.body.numRecords < 0)
      return res.status(400).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    limit = Number(req.body.numRecords);
  }
  if (req.body.page) {
    page = Number(req.body.page);
  }

  // Check for isDashboard parameter in the request body
  if (req.body.isDashboard !== undefined) {
    if (req.body.isDashboard === true) {
      query['games.isDashboard'] = true;
    } else if (req.body.isDashboard === false) {
      query['games.isDashboard'] = false;
    }
  }

  // Check for isMobile parameter in the request body
  if (req.body.isMobile !== undefined) {
    query['games.mobile'] = true;
  } else if (req.body.isMobile === false) {
    query['games.isMobile'] = false;
  }

  // Retrieve all games matching the query

  // Check for gameCategory parameter in the request body
  if (req.body.gameCategory !== undefined) {
    query['games.category'] = req.body.gameCategory;
  }

  SelectedCasino.find(query)
    .select({ _id: 0, __v: 0, status: 0 })
    .lean()
    .exec((err, data) => {
      if (err) return res.status(500).send({ message: 'USERS_PAGINATION_FAILED' });

      const allGames = [];
      data.forEach(item => {
        item.games.forEach(game => {
          if (
            (req.body.isDashboard === undefined || game.isDashboard === req.body.isDashboard) &&
            (req.body.isMobile === undefined || game.mobile === req.body.isMobile) &&
            (req.body.gameCategory === undefined || game.category === req.body.gameCategory)
          ) {
            allGames.push({
              id: game.id,
              name: game.name,
              image_filled: game.image_filled,
              isDashboard: game.isDashboard,
              isMobile: game.mobile,
              category: item.category
            });
          }
        });
      });

      // Apply pagination based on the requested number of records
      const totalRecords = allGames.length;
      const totalPages = Math.ceil(totalRecords / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = Math.min(startIndex + limit, totalRecords);
      const paginatedGames = allGames.slice(startIndex, endIndex);

      return res.send({
        message: 'Selected Casino Games List',
        success: true,
        results: paginatedGames,
        pagination: {
          total: totalRecords,
          totalPages: totalPages,
          currentPage: page,
          recordsPerPage: limit
        }
      });
    });
}
function getSelectedGamesCategories(req, res) {
      SelectedCasino.find({},{category:1,_id:0}, (err, categories) => {
        if (err || !categories)
          return res.status(500).send({ message: 'categories not found' });

        return res.send({
          message: 'Selected Casino Games Category List',
          success: true,
          categories: categories,
        })
      })
}

//for sport book
async function getGameDirect(req, res) {
  try {
    const errors = validationResult(req);
    if (errors.errors.length !== 0) {
      return res.status(400).send({ errors: errors.errors });
    }

    if( req.decoded.role !== '5' ){
      return res.status(200).send({ message: 'you are not allowed to play casino games',success:false})
    }
    const { homeurl, cashierurl, gameid } = req.body;
    const user = await User.findOne({ userId: req.decoded.userId });

    const payload = {
      api_password: config.api_password,
      api_login: config.api_username,
      method: 'getGameDirect',
      lang: config.language,
      user_username: 'user_' + user.userId,
      user_password: 'user_' + user.userId,
      homeurl,
      cashierurl,
      gameid,
      play_for_fun: config.play_for_fun,
      currency: config.currency,
    };

    const response = await axios.post(config.apiUrl, payload);
    res.status(200).send({
      success: true,
      message: 'Direct game data found successfully',
      results: response.data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: 'Failed to get game' });
  }
}

loginRouter.post('/getSelectedGamesBySearch', getSelectedGamesBySearch);
loginRouter.post('/addCasinoGameDetails', addCasinoGameDetails);

loginRouter.get('/getAllCasinoCategories', getAllCasinoCategories);

loginRouter.get('/getCategoryCasinoGames', getCategoryCasinoGames);

loginRouter.get('/getAllSelectedCasinos', getAllSelectedCasinos);

loginRouter.post(
  '/addSelectedCasinoCategories',
  selectedCasinoValidator.validate('addSelectedCasinoCategories'),
  addSelectedCasinoCategories
);

loginRouter.post('/getGame', getGame);
loginRouter.get('/getDashboardGames', getDashboardGames);
loginRouter.get('/getGamesByName', getGamesByName);
loginRouter.post('/addSelectedDashboardGames', addSelectedDashboardGames);

loginRouter.get('/getSelectedGamesCategories', getSelectedGamesCategories);
loginRouter.get('/getGameDirect', getGameDirect);

module.exports = { loginRouter };
