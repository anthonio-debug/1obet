const express = require("express")();
const bodyParser = require('body-parser');

const app = express(); // Initialize Express
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Endpoint to handle /api/poker/auth
app.post('/api/poker/auth', (req, res) => {
    try {
      const { token, operatorId } = req.body;
  
      if (!token || !operatorId) {
        return res.status(400).json({ message: 'Invalid request: Missing token or operatorId' });
      }
  
      console.log('Request received:', { token, operatorId });
  
      // Send a success response
      return res.status(200).json({ message: 'Authentication successful' });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});