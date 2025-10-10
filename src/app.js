const express = require('express');
const cors = require('cors');

const app = express();

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Enable parsing of JSON request bodies

// --- Routes ---
app.get('/', (req, res) => {
  res.send('Welcome to the Real Estate API! The database is connected.');
});

// Later, we will add our API routes here like this:
const propertyRoutes = require('./api/routes/properties.routes');
app.use('/api/v1/properties', propertyRoutes);

module.exports = app; // Export the configured app
