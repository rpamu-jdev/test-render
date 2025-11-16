const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agents.controller.js');

// --- Agent Management (Admin) ---
router.post('/create', agentController.createAgent);
router.post('/update', agentController.updateAgent);
router.post('/delete', agentController.deleteAgent);
router.post('/details', agentController.getAgentDetails);
router.post('/list', agentController.listAllAgents);

// --- Subscription ---
router.post('/subscribe', agentController.subscribeToPlan);

// --- Agent Review CRUD ---
router.post('/reviews/add', agentController.addReview);
router.post('/reviews/list', agentController.listReviews);
router.post('/reviews/update', agentController.updateReview);
router.post('/reviews/delete', agentController.deleteReview);

module.exports = router;

