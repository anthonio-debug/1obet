const io = require('socket.io-client');

// Connect to the socket server
const socket = io('https://server.1obet.net:4000');

// Listen for 'connect' event
socket.on('connect', () => {
  console.log('Connected to socket server');

// setInterval(() => {
  socket.emit('listOdds', '1107231737');
// }, interval);
});

socket.on('listOdds_response', (response) => {
  console.log('Received event1 response:', response);
});

// socket.on('racesMarketOdds_response', (response) => {
//   console.log('Received event2 response:', response);
// });

socket.on('disconnect', () => {
  console.log('Disconnected from socket server');
});

