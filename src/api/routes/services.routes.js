const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/services.controller.js');

// Create a new service
router.post('/create', serviceController.createService);

// Get a list of all services
router.post('/list', serviceController.getAllServices);

// Update an existing service
router.post('/update', serviceController.updateService);

// Delete a service
router.post('/delete', serviceController.deleteService);

module.exports = router;
