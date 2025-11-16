const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller.js');

// Gets the list of all conversations for a user
router.post('/inbox', chatController.getInbox);

// Gets the message history for a single conversation
router.post('/history', chatController.getMessageHistory);

// Finds a 1-to-1 conversation or creates a new one
router.post('/find-or-create', chatController.findOrCreateConversation);

module.exports = router;
