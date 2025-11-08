const db = require('../../config/database');

/**
 * @description Find an existing 1-to-1 chat or create a new one.
 * @route POST /api/v1/chat/find-or-create
 * @payload data: { user_id_1: "...", user_id_2: "..." }
 */
const findOrCreateConversation = async (req, res) => {
    const { identifier, data } = req.body;
    const { user_id_1, user_id_2 } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!user_id_1 || !user_id_2) {
        return res.status(400).json({ identifier: responseIdentifier, data: { error: 'Both user IDs are required.' }});
    }

    const client = await db.getClient();
    try {
        // --- 1. Check for an existing 1-to-1 conversation ---
        // This query finds a conversation that has *exactly* these two participants
        const findQuery = `
            SELECT p1.conversation_id
            FROM chat_participants p1
            JOIN chat_participants p2 ON p1.conversation_id = p2.conversation_id
            WHERE p1.user_id = $1 AND p2.user_id = $2
            LIMIT 1;
        `;
        const existing = await client.query(findQuery, [user_id_1, user_id_2]);

        if (existing.rows.length > 0) {
            // A conversation already exists
            return res.status(200).json({
                identifier: responseIdentifier,
                data: {
                    conversation_id: existing.rows[0].conversation_id,
                    is_new: false
                }
            });
        }

        // --- 2. If not found, create a new conversation ---
        await client.query('BEGIN');
        
        // a. Create the conversation "room"
        const newConvRes = await client.query('INSERT INTO chat_conversations DEFAULT VALUES RETURNING id');
        const conversation_id = newConvRes.rows[0].id;

        // b. Add both participants to the room
        const participantsQuery = `
            INSERT INTO chat_participants (conversation_id, user_id)
            VALUES ($1, $2), ($1, $3);
        `;
        await client.query(participantsQuery, [conversation_id, user_id_1, user_id_2]);
        
        await client.query('COMMIT');

        res.status(201).json({
            identifier: responseIdentifier,
            data: {
                conversation_id: conversation_id,
                is_new: true
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error finding or creating conversation:', error);
        res.status(500).json({ identifier: responseIdentifier, data: { error: 'An internal server error occurred.' }});
    } finally {
        client.release();
    }
};

/**
 * @description Get a user's inbox (list of all their conversations)
 * @route POST /api/v1/chat/inbox
 * @payload data: { user_id: "..." }
 */
const getInbox = async (req, res) => {
    const { identifier, data } = req.body;
    const { user_id } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!user_id) {
        return res.status(400).json({ identifier: responseIdentifier, data: { error: '"user_id" is required.' }});
    }

    try {
        // This query finds all conversations the user is in, and for each one,
        // joins to get the *other* participant's ID.
        const query = `
            SELECT
                c.id AS conversation_id,
                c.last_message_preview,
                c.last_message_at,
                p_other.user_id AS participant_user_id,
                u.name AS participant_user_name  -- Here is the user's name
            FROM
                chat_conversations c
            JOIN
                chat_participants p_self ON c.id = p_self.conversation_id
            JOIN
                chat_participants p_other ON c.id = p_other.conversation_id
            JOIN
                users u ON p_other.user_id = u.user_id -- Join users table to get the name
            WHERE
                p_self.user_id = $1 AND p_other.user_id != $1
            ORDER BY
                c.last_message_at DESC;
        `;
        const result = await db.query(query, [user_id]);

        // Your Flutter app will receive this list. For each item,
        // it can then use the 'participant_user_id' to call your
        // existing /vendors/details or /agents/details endpoints to get their name and profile picture.
        res.status(200).json({
            identifier: responseIdentifier,
            data: { conversations: result.rows }
        });

    } catch (error) {
        console.error('Error getting inbox:', error);
        res.status(500).json({ identifier: responseIdentifier, data: { error: 'An internal server error occurred.' }});
    }
};

/**
 * @description Get the message history for one conversation
 * @route POST /api/v1/chat/history
 * @payload data: { conversation_id: "...", page: 1, limit: 20 }
 */
const getMessageHistory = async (req, res) => {
    const { identifier, data } = req.body;
    const { conversation_id, page = 1, limit = 20 } = data;
    const offset = (page - 1) * limit;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!conversation_id) {
        return res.status(400).json({ identifier: responseIdentifier, data: { error: '"conversation_id" is required.' }});
    }
    
    try {
        const query = `
            SELECT * FROM chat_messages
            WHERE conversation_id = $1
            ORDER BY sent_at DESC
            LIMIT $2 OFFSET $3;
        `;
        const result = await db.query(query, [conversation_id, limit, offset]);

        // We return messages in reverse (newest first) for pagination
        // The client can .reverse() this array to display
        res.status(200).json({
            identifier: responseIdentifier,
            data: { messages: result.rows }
        });
    } catch (error) {
        console.error('Error getting message history:', error);
        res.status(500).json({ identifier: responseIdentifier, data: { error: 'An internal server error occurred.' }});
    }
};

module.exports = {
    findOrCreateConversation,
    getInbox,
    getMessageHistory
};
