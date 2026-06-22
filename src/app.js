const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname, '../public')));

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
