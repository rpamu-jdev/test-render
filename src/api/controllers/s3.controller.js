const s3 = require('../../config/s3');
require('dotenv').config();

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

/**
 * @description Generates pre-signed URLs for uploading multiple files to S3.
 * @route POST /api/v1/s3/presigned-url
 */
const generatePresignedUrl = async (req, res) => {
  const { identifier, data } = req.body;
  const responseIdentifier = identifier || { id: null, user: null };

  // Validate that the request contains a 'files' array
  if (!data || !Array.isArray(data.files) || data.files.length === 0) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request "data" must include a non-empty "files" array.' },
    });
  }

  try {
    // Use Promise.all to generate all URLs concurrently for better performance
    const urlPromises = data.files.map(file => {
      // Validate each file object in the array
      if (!file.file_name || !file.file_type) {
        throw new Error('Each file object must include "file_name" and "file_type".');
      }

      // Create a unique key for the S3 object
      const s3Key = `uploads/${Date.now()}-${file.file_name}`;

      const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Expires: 60 * 5, // URL expires in 5 minutes
        ContentType: file.file_type,
        // ACL: 'public-read',
      };

      // Return a promise that resolves with all the necessary info
      return s3.getSignedUrlPromise('putObject', params).then(upload_url => ({
        upload_url,
        public_url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
        s3_key: s3Key,
        original_file_name: file.file_name, // Include original name for client-side reference
      }));
    });

    // Wait for all promises to resolve
    const signedUrls = await Promise.all(urlPromises);

    res.status(200).json({
      identifier: responseIdentifier,
      data: {
        urls: signedUrls,
      },
    });

  } catch (error) {
    console.error('Error generating pre-signed URLs:', error);
    // Handle specific validation error from the loop
    if (error.message.includes('Each file object must include')) {
        return res.status(400).json({
            identifier: responseIdentifier,
            data: { error: error.message }
        });
    }
    // Handle generic server errors
    res.status(500).json({
      identifier: responseIdentifier,
      data: { error: 'Could not generate pre-signed URLs.' },
    });
  }
};

module.exports = {
  generatePresignedUrl,
};

