const { WebSocketServer } = require('ws');
const db = require('./database');
const url = require('url');

// This map stores the active connection for each user
// Map<userId, WebSocketConnection>
const connectionMap = new Map();

function initializeWebSocket(httpServer) {
    const wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request, socket, head) => {
        const { pathname, query } = url.parse(request.url, true);

        // --- ADDED THIS LOG ---
        // This will show us the exact path your client is requesting
        console.log(`[WebSocket] Upgrade requested for path: ${pathname}`);

        if (pathname === '/ws') {
            const userId = query.userId;

            if (!userId) {
                console.log('[WebSocket] Connection rejected: Path is correct, but no userId provided.');
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            wss.handleUpgrade(request, socket, head, (ws) => {
                connectionMap.set(userId, ws);
                console.log(`[WebSocket] User connected: ${userId}`);
                wss.emit('connection', ws, userId);
            });
        } else {
            // This is the most likely cause of your "socket hang up" error.
            console.log(`[WebSocket] Connection rejected: Invalid path. Path must be /ws. Destroying socket.`);
            // Explicitly send a 404 Not Found before destroying
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
            socket.destroy();
        }
    });

    // --- No changes below this line, full logic included ---

    wss.on('connection', (ws, userId) => {
        
        ws.on('message', async (messageData) => {
            try {
                const message = JSON.parse(messageData);
                
                if (message.type === 'send_message' && message.payload) {
                    const { conversation_id, message_body } = message.payload;
                    const sender_id = userId; 

                    if (!conversation_id || !message_body) {
                        return; 
                    }

                    // --- a. Save the message to the database ---
                    const dbQuery = `
                        INSERT INTO chat_messages (conversation_id, sender_id, message_body, sent_at)
                        VALUES ($1, $2, $3, NOW())
                        RETURNING *;
                    `;
                    const dbResult = await db.query(dbQuery, [conversation_id, sender_id, message_body]);
                    const savedMessage = dbResult.rows[0];
                    
                    // --- b. Update the conversation's "last message" preview ---
                    const preview = message_body.length > 50 ? message_body.substring(0, 47) + '...' : message_body;
                    await db.query(
                        'UPDATE chat_conversations SET last_message_preview = $1, last_message_at = $2 WHERE id = $3',
                        [preview, savedMessage.sent_at, conversation_id]
                    );

                    // --- c. Forward the message to all *other* participants ---
                    const participantsQuery = `
                        SELECT user_id FROM chat_participants 
                        WHERE conversation_id = $1;
                    `;
                    const participantsRes = await db.query(participantsQuery, [conversation_id]);

                    // Loop through all participants in this chat
                    for (const participant of participantsRes.rows) {
                        
                        // --- THIS IS THE FIX ---
                        // Only send to other participants, not the original sender
                        if (participant.user_id !== sender_id) {
                            const recipientSocket = connectionMap.get(participant.user_id);

                            // Check if the participant is online
                            if (recipientSocket && recipientSocket.readyState === recipientSocket.OPEN) {
                                // Send the saved message to the recipient
                                recipientSocket.send(JSON.stringify({
                                    type: 'new_message',
                                    payload: savedMessage
                                }));
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
            }
        });

        ws.on('close', () => {
            console.log(`[WebSocket] User disconnected: ${userId}`);
            connectionMap.delete(userId);
        });

        ws.on('error', (error) => {
            console.error('[WebSocket] Error:', error);
            connectionMap.delete(userId);
        });
    });

    console.log('✅ WebSocket server initialized.');
}

module.exports = { initializeWebSocket };

