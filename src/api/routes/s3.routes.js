const express = require('express');
const router = express.Router();
const s3Controller = require('../controllers/s3.controller');

// Generate a pre-signed URL for S3 uploads
router.post('/presigned-url', s3Controller.generatePresignedUrl);

module.exports = router;
