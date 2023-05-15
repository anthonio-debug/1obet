const io = require('socket.io-client');
// const matchData = require('./app/models/match');
// Connect to the server
const socket = io('http://127.0.0.1:3001');

// Listen for the connection event to confirm the connection
socket.on('connection', (message) => {
  console.log(message);
});

// Handle bet placement
const betData = {
  sportsId: 1,
  matchId: '64458338-704e-4d0f-b4fa-6af920ab467d',
  userId: 136,
  betAmount: 100,
  betRate: 1.5,
  selectedTeam: 'Oman',
};
console.log('Sending placeBet event with data:', betData);
socket.emit('placeBet', betData);

// Emit an event to get the bet rate list
socket.emit('getBetRateList', {
  sportsId: 1,
  teams: ['Oman', 'Saudi Arabia'],
  selectedTeam: 'Oman',
});

// Handle the response from the server
socket.on('betRateList', (data) => {
  console.log('Bet rate list:', data);
});
// Subscribe to the bet results channel
socket.on('betResult', (data) => {
  const { betId, result } = data;
  console.log(`Bet ID ${betId} result: ${result}`);

  // Handle the bet result
  if (result === 'win') {
    // Handle winning bets
    handleWinningBet(betId);
  } else if (result === 'lose') {
    // Handle losing bets
    handleLosingBet(betId);
  } else {
    // Handle pending bets
    handlePendingBet(betId);
  }
});

// socket.emit('currentMatches', {
//   apikey: 'd4bc7b00-5b85-4ff4-b2f7-c7eab71939af',
//   offset: 0,
// });

// Listen for the data event to receive the response data from the server
socket.on('currentMatchesData', (responseData) => {
  console.log(responseData);
  // Do something with the response data here
});
// Handle disconnects
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// Handle disconnects
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
