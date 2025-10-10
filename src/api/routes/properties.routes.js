const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/properties.controller');

// --- Define the CRUD routes ---

// CREATE a new property
// Handles POST /api/v1/properties
router.post('/', propertyController.createProperty);

// READ a list of properties
// Handles GET /api/v1/properties
router.get('/', propertyController.getProperties);

// READ a single property by its ID
// Handles POST /api/v1/properties/details
router.post('/details', propertyController.getPropertyById);


// UPDATE a property by ID (Placeholder for later)
// router.put('/:id', propertyController.updateProperty);

// DELETE a property by ID (Placeholder for later)
// router.delete('/:id', propertyController.deleteProperty);

module.exports = router;

