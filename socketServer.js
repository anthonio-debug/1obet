// First, install the necessary libraries
// npm install express socket.io axios mongoose

// Import the required libraries
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const mongoose = require('mongoose');
const Bets = require('./app/models/bets');
const Match = require('./app/models/matches');
const CricketMatch = require('./app/models/cricketMatches');

// Set up the app and server
const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  pingInterval: 5000,
  pingTimeout: 60000,
  cookie: false,
  // origins: 'http://localhost:3000/',
  handlePreflightRequest: (req, res) => {
    //console.log('Request Header Preflight:',req)
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Allow-Headers': ['authorization', 'mdgsessionid'],
      'Access-Control-Allow-Credentials': true,
    });
    res.end();
  },
});

mongoose.set('strictQuery', false);

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/Bet99', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function () {
  console.log('MongoDB connected');
});

// Set up the route to handle incoming socket connections
// Handle incoming socket connections
function startSocketServer(app) {
  io.on('connection', (socket) => {
    console.log('New client connected');

    // Send a message to the client to confirm the connection
    socket.emit('connection', 'You are now connected to the server.');

    // Handle bet placement
    socket.on('placeBet', async (data) => {
      const { sportsId, userId, selectedTeam, betAmount, betRate, matchId } =
        data;
      console.log('sportsId', data);
      // Get the match data
      const match = await CricketMatch.findOne({
        sportsId: sportsId,
        id: matchId,
      }).exec();
      console.log('match.teams', match.teams);
      if (!match) {
        console.log(`Match not found for sports ID ${sportsId}`);
        return;
      }

      // Check if the match has ended
      if (match.matchEnded) {
        console.log(`Match has already ended for sports ID ${sportsId}`);
        return;
      }

      const teams = [match.teams[0], match.teams[1]];
      const userBetRate = BetRateList.getBetRateList(
        sportsId,
        teams,
        selectedTeam
      );

      // Check if the user's bet rate is available
      if (!userBetRate.includes(betRate)) {
        console.log(
          `Bet rate not available for user ID ${userId} and sports ID ${sportsId}`
        );
        return;
      }

      // Calculate the return amount
      const returnAmount = betAmount * betRate;

      // Create the bet object
      const bet = new Bets({
        sportsId,
        userId,
        team: selectedTeam,
        betAmount,
        betRate,
        returnAmount,
        matchId: matchId,
        status: 'pending',
      });

      // Save the bet object to the database
      await bet.save();

      console.log(
        `Bet placed for user ID ${userId}, sports ID ${sportsId}, and team ${selectedTeam}`
      );

      // Emit the bet result to the user who placed the bet
      socket
        .to(`user-${userId}`)
        .emit('betResult', { betId: bet._id, result: 'pending' });
    });

    socket.on('currentMatches', async (params) => {
      // Get the match data
      axios
        .get('https://api.cricapi.com/v1/currentMatches', { params })
        .then((response) => {
          socket.emit('currentMatchesData', response.data);
        })
        .catch((error) => {
          console.log(error);
        });
    });

    // Handle getting the bet rate list
    socket.on('getBetRateList', (data) => {
      const { sportsId, teams, selectedTeam } = data;
      const betRateList = BetRateList.getBetRateList(
        sportsId,
        teams,
        selectedTeam
      );
      socket.emit('betRateList', betRateList);
    });

    // Handle winning bets
    function handleWinningBet(betId) {
      console.log(`Bet ID ${betId} won`);
      // Update the bet status to 'won'
      Bets.updateOne({ _id: betId }, { status: 'won' }).exec();
      // Emit the updated bet result to the user
      socket.to(`user-${userId}`).emit('betResult', { betId, result: 'won' });
    }

    // Handle losing bets
    function handleLosingBet(betId) {
      console.log(`Bet ID ${betId} lost`);
      // Update the bet status to 'lost'
      Bets.updateOne({ _id: betId }, { status: 'lost' }).exec();
      // Emit the updated bet result to the user
      socket.to(`user-${userId}`).emit('betResult', { betId, result: 'lost' });
    }

    // Handle pending bets
    function handlePendingBet(betId) {
      console.log(`Bet ID ${betId} is still pending`);
      // Update the bet status to 'pending'
      Bets.updateOne({ _id: betId }, { status: 'pending' }).exec();
      // Emit the updated bet result to the user
      socket
        .to(`user-${userId}`)
        .emit('betResult', { betId, result: 'pending' });
    }

    // Handle disconnects
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
}

const BetRateList = {
  //to do on sportsId and on matchId ratelist
  getBetRateList: (sportsId, teams, selectedTeam) => {
    let betRateList = [];
    console.log('teams', teams);
    console.log('selectedteams', selectedTeam);

    switch (sportsId) {
      case 1: // if sportsId is 1 (e.g. cricket)
        if (selectedTeam === teams[0]) {
          betRateList = [1.5, 2.0, 2.5, 3.0];
        } else if (selectedTeam === teams[1]) {
          betRateList = [2.0, 2.5, 3.0, 3.5];
        } else {
          throw new Error('Invalid team');
        }
        break;
      case 2: // if sportsId is 2 (e.g. basketball)
        if (selectedTeam === teams[0]) {
          betRateList = [1.2, 1.5, 2.0, 2.5];
        } else if (selectedTeam === teams[1]) {
          betRateList = [1.5, 2.0, 2.5, 3.0];
        } else {
          throw new Error('Invalid team');
        }
        break;
      // add more cases for other sports
      default: // if sportsId is not recognized
        throw new Error('Invalid sportsId');
    }

    return betRateList;
  },
};

// // Start the server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = { startSocketServer };
