// This is a new file
// src/api/routes/notification.routes.js

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');

// Handles POST /api/v1/notifications/send-to-users
router.post('/send-to-users', notificationController.sendToUsers);

module.exports = router;