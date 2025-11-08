const express = require('express');
const router = express.Router();
const userDeviceController = require('../controllers/userDevice.controller');

// CREATE / UPDATE (Upsert) a device
// Handles POST /api/v1/devices/register
router.post('/register', userDeviceController.registerDevice);

// READ all devices for a user
// Handles POST /api/v1/devices/get-by-user
router.post('/get-by-user', userDeviceController.getDevicesByUserId);

// DELETE a device
// Handles POST /api/v1/devices/unregister
router.post('/unregister', userDeviceController.unregisterDevice);

module.exports = router;