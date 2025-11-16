const AWS = require('aws-sdk');
require('dotenv').config();

// Configure the AWS SDK with your credentials from the .env file
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: 'v4', // Important for pre-signed URLs
});

// Create and export the S3 client instance
const s3 = new AWS.S3();

module.exports = s3;
