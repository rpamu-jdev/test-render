// This is a new file
// src/api/controllers/notification.controller.js

const db = require('../../config/database');
const firebase_admin = require('../../config/firebase'); // Use your existing firebase admin

/**
 * @description Send a notification to a list of user IDs
 * @route POST /api/v1/notifications/send-to-users
 */
const sendToUsers = async (req, res) => {
    const { identifier, data } = req.body;

    const responseIdentifier = identifier || { request_id: null, user_id: null };
    
    // Get the list of users and the message content from the request
    const { user_ids, title, body, data_payload } = data;

    // --- Validation ---
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({
            identifier: responseIdentifier,
            data: { error: 'Request data must contain a "user_ids" array.' },
        });
    }
    if (!title || !body) {
        return res.status(400).json({
            identifier: responseIdentifier,
            data: { error: 'Request data must contain "title" and "body".' },
        });
    }

    let uniqueTokens = [];
    try {
        // --- 1. Fetch all unique FCM tokens for the given user IDs ---
        const query = `
            SELECT DISTINCT fcm_token 
            FROM user_devices 
            WHERE user_id = ANY($1::text[]);
        `;
        const { rows } = await db.query(query, [user_ids]);
        
        if (rows.length === 0) {
            return res.status(404).json({
                identifier: responseIdentifier,
                data: { error: 'No registered devices found for the provided user IDs.' }
            });
        }

        uniqueTokens = rows.map(row => row.fcm_token);

        
        // --- 2. Construct the FCM message payload ---
        const message = {
            tokens: uniqueTokens,
            notification: {
                title: title,
                body: body,
            },
            data: data_payload || {}, // Attach custom data if provided
        };

        // --- 3. Send the message to all tokens at once ---
        const response = await firebase_admin.messaging().sendEachForMulticast(message);
          
        console.log(response)
        // --- 4. (CRITICAL) Clean up stale tokens ---
        const tokensToDelete = [];
        response.responses.forEach((result, index) => {
            if (!result.success) {
                const errorCode = result.error.code;
                // Check for errors indicating a stale or invalid token
                if (errorCode === 'messaging/registration-token-not-registered' ||
                    errorCode === 'messaging/invalid-registration-token') {
                    
                    const badToken = uniqueTokens[index];
                    tokensToDelete.push(badToken);
                    console.log(`[FCM Cleanup] Scheduling token for deletion: ${badToken}`);
                }
            }
        });

        if (tokensToDelete.length > 0) {
            // Asynchronously delete all stale tokens from the database
            db.query('DELETE FROM user_devices WHERE fcm_token = ANY($1::text[])', [tokensToDelete])
                .then(() => console.log(`[FCM Cleanup] Successfully deleted ${tokensToDelete.length} stale tokens.`))
                .catch(err => console.error('[FCM Cleanup] Error deleting stale tokens:', err));
        }
        
        // --- 5. Return the final response to the client ---
        res.status(200).json({
            identifier: responseIdentifier,
            data: {
                message: `Successfully sent notifications.`,
                successCount: response.successCount,
                failureCount: response.failureCount,
            }
        });

    } catch (error) {
        console.error('❌ Error in sendToUsers controller:', error);
        res.status(500).json({
            identifier: responseIdentifier,
            data: { error: 'An error occurred while sending notifications.' }
        });
    }
};

module.exports = {
    sendToUsers,
};