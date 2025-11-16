require('dotenv').config();
const http = require('http'); // Import Node's built-in HTTP module
const app =require('./src/app'); // Your existing Express app
const db = require('./src/config/database');
const { initializeWebSocket } = require('./src/config/websocket'); // Import the WS initializer

const PORT = process.env.PORT || 3000;

// 1. Create an HTTP server using your Express app as the handler
const server = http.createServer(app);

// 2. Initialize the WebSocket server and attach it to the HTTP server
//    This will allow it to listen for the 'upgrade' event
initializeWebSocket(server);

// 3. Start the combined server (HTTP + WebSocket)
server.listen(PORT, async () => {
    try {
        // Test the database connection
        await db.query('SELECT NOW()');
        console.log('✅ Successfully connected to the Aiven PostgreSQL database!');
        console.log(`🚀 Server (HTTP + WebSocket) is listening on http://localhost:${PORT}`);
    } catch (err) {
        console.error('❌ Unable to connect to the database:', err);
    }
});

