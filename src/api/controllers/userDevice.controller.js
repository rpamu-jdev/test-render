const db = require('../../config/database');

/**
 * @description Register a new device or update an existing one (Upsert)
 * @route POST /api/v1/devices/register
 */
const registerDevice = async (req, res) => {
  const { identifier, data } = req.body;
  const responseIdentifier = identifier || { requestId: null, userId: null };

  const { userId, deviceId, fcmToken } = data;

  if (!userId || !deviceId || !fcmToken) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request data must contain userId, deviceId, and fcmToken.' },
    });
  }

  try {
    const query = `
      INSERT INTO user_devices (device_id, user_id, fcm_token, last_updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (device_id) 
      DO UPDATE SET
        fcm_token = EXCLUDED.fcm_token,
        user_id = EXCLUDED.user_id,
        last_updated_at = NOW()
      RETURNING device_id AS "deviceId", user_id AS "userId", fcm_token AS "fcmToken", last_updated_at AS "lastUpdatedAt";
    `;
    
    const { rows } = await db.query(query, [deviceId, userId, fcmToken]);

    res.status(201).json({
      identifier: responseIdentifier,
      data: { message: 'Device registered successfully', device: rows[0] },
    });

  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({
      identifier: responseIdentifier,
      data: { error: 'An error occurred while registering the device.' }
    });
  }
};

/**
 * @description Get all devices for a specific user
 * @route POST /api/v1/devices/get-by-user
 */
const getDevicesByUserId = async (req, res) => {
  const { identifier, data } = req.body;
  const responseIdentifier = identifier || { requestId: null, userId: null };
  const { userId } = data; // Get userId from req.body.data

  if (!userId) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request data must contain userId.' },
    });
  }

  try {
    // Use SQL aliases to return camelCase fields
    const query = `
      SELECT 
        device_id AS "deviceId", 
        fcm_token AS "fcmToken", 
        last_updated_at AS "lastUpdatedAt" 
      FROM user_devices 
      WHERE user_id = $1
    `;
    const { rows } = await db.query(query, [userId]);

    res.status(200).json({
      identifier: responseIdentifier,
      data: rows,
    });

  } catch (error)
    {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      identifier: responseIdentifier,
      data: { error: 'An error occurred while fetching devices.' }
    });
  }
};

/**
 * @description Unregister (delete) a device, e.g., on logout
 * @route POST /api/v1/devices/unregister
 */
const unregisterDevice = async (req, res) => {
  const { identifier, data } = req.body;
  const responseIdentifier = identifier || { requestId: null, userId: null };
  const { deviceId } = data; // Get deviceId from req.body.data

  if (!deviceId) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request data must contain deviceId.' },
    });
  }

  try {
    const query = 'DELETE FROM user_devices WHERE device_id = $1 RETURNING *';
    const { rows } = await db.query(query, [deviceId]);

    if (rows.length === 0) {
      return res.status(404).json({
        identifier: responseIdentifier,
        data: { error: 'Device not found.' }
      });
    }

    res.status(200).json({
      identifier: responseIdentifier,
      data: { message: 'Device unregistered successfully' }
    });

  } catch (error) {
    console.error('Error unregistering device:', error);
    res.status(500).json({
      identifier: responseIdentifier,
      data: { error: 'An error occurred while unregistering the device.' }
    });
  }
};

module.exports = {
  registerDevice,
  getDevicesByUserId,
  unregisterDevice,
};