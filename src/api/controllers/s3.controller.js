const s3 = require('../../config/s3');
require('dotenv').config();

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

/**
 * @description Generates a pre-signed URL for uploading a file to S3.
 * @route POST /api/v1/s3/presigned-url
 */
const generatePresignedUrl = async (req, res) => {
  const { identifier, data } = req.body;
  const responseIdentifier = identifier || { id: null, user: null };

  if (!data || !data.file_name || !data.file_type) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request "data" must include "file_name" and "file_type".' },
    });
  }

  const { file_name, file_type } = data;

  // Create a unique key for the S3 object to prevent overwrites
  const s3Key = `uploads/${Date.now()}-${file_name}`;

  // Define the parameters for the pre-signed URL
  const params = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Expires: 60 * 5, // URL expires in 5 minutes
    ContentType: file_type,
    // ACL: 'public-read', // Optional: Makes the uploaded file publicly readable
  };

  try {
    // Generate the pre-signed URL
    const uploadUrl = await s3.getSignedUrlPromise('putObject', params);
    
    // The public URL of the file after it's uploaded
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    res.status(200).json({
      identifier: responseIdentifier,
      data: {
        upload_url: uploadUrl, // Changed from uploadUrl
        public_url: publicUrl, // Changed from publicUrl
        s3_key: s3Key,         // Changed from s3Key
      },
    });
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    res.status(500).json({
      identifier: responseIdentifier,
      data: { error: 'Could not generate pre-signed URL.' },
    });
  }
};

module.exports = {
  generatePresignedUrl,
};
