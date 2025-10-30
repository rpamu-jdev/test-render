const express = require('express');
const router = express.Router();
const subController = require('../controllers/subscriptions.controller.js');

// Admin CRUD for Subscription Plans
router.post('/create', subController.createPlan);
router.post('/list',   subController.listSubscriptionPlans);
router.post('/update', subController.updatePlan);
router.post('/delete', subController.deletePlan);

module.exports = router;

