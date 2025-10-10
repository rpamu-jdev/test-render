const { Pool } = require('pg');
require('dotenv').config();

// Create a new connection pool using the environment variables
// This is configured for your Aiven cloud database with SSL
const pool = new Pool({
  user: process.env.PG_DB_USER,
  host: process.env.PG_DB_HOST,
  database: process.env.PG_DB_NAME,
  password: process.env.PG_DB_PASSWORD,
  port: process.env.PG_DB_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

// A simple function to test the connection
async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    console.log('Successfully connected to the Aiven PostgreSQL database!');
  } catch (err) {
    console.error('Failed to connect to the database.', err);
  } finally {
    if (client) client.release();
  }
}

// Test the connection
testConnection();

// Export the pool so other parts of your app can use it later
module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
