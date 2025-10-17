const express = require('express');
const router = express.Router();
const userController = require('../controllers/users.controller');

// --- Favorite Properties Routes ---

// Add a property to favorites
router.post('/favorites/add', userController.addFavorite);

// Remove a property from favorites
router.post('/favorites/remove', userController.removeFavorite);

// Get a list of a user's favorite properties
router.post('/favorites/list', userController.getFavorites);

router.post('/views/list', userController.getRecentlyViewed);

module.exports = router;
