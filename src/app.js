const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// --- API Routes ---
const propertyRoutes = require('./api/routes/properties.routes');
app.use('/api/v1/properties', propertyRoutes);

// --- Catch-all: serve the website ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
