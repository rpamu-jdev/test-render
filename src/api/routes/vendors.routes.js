const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendors.controller.js');

// --- Vendor CRUD ---
router.post('/create', vendorController.createVendor);
router.post('/details', vendorController.getVendorDetails);
router.post('/search-by-service', vendorController.listVendorsByService);
router.post('/list', vendorController.listAllVendors); 

// --- Review Routes ---
router.post('/reviews/add', vendorController.addReview);
router.post('/reviews/list', vendorController.listVendorReviews);
router.post('/reviews/update', vendorController.updateReview);
router.post('/reviews/delete', vendorController.deleteReview);


module.exports = router;

