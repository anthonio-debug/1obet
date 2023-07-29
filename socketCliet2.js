const io = require('socket.io-client');

const socket = io('https://server.1obet.net:4001');
socket.on('connect', () => {
  console.log('Connected to socket server');
});

// Listen for 'event1_response' event
socket.on('listOdds_response', (response) => {
  console.log('Received event1 response:', response);
});


// Listen for 'disconnect' event
socket.on('disconnect', () => {
  console.log('Disconnected from socket server');
});

