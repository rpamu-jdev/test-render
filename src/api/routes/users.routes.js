const express = require('express');
const router = express.Router();
const userController = require('../controllers/users.controller');

// Add a property to favorites
// --- Favorite Properties Routes ---
router.post('/favorites/add', userController.addFavorite);
router.post('/favorites/remove', userController.removeFavorite);
router.post('/favorites/list', userController.getFavorites);
router.post('/views/list', userController.getRecentlyViewed);

// User Management
router.post('/create', userController.createUser);
router.post('/get-by-id', userController.getUserById);
router.post('/update', userController.updateUser);
router.post('/delete', userController.deleteUser);
router.post('/list', userController.listAndSearchUsers);


module.exports = router;
