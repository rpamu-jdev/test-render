const express = require('express');
const cors = require('cors');

const app = express();

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Enable parsing of JSON request bodies

// --- Routes ---
app.get('/', (req, res) => {
  res.send('Welcome to the Real Estate API! The database is connected.');
});

// Later, we will add our API routes here like this:
const propertyRoutes = require('./api/routes/properties.routes');
app.use('/api/v1/properties', propertyRoutes);

const s3Routes = require('./api/routes/s3.routes');
app.use("/api/v1/s3/",s3Routes);

const userRoutes = require('./api/routes/users.routes');
app.use("/api/v1/users/",userRoutes);

const servicesRoute = require('./api/routes/services.routes');
app.use("/api/v1/services/",servicesRoute);

const vendorRoutes  = require('./api/routes/vendors.routes');
app.use("/api/v1/vendors/",vendorRoutes);


const agentRoute = require('./api/routes/agents.routes');
app.use("/api/v1/agents/",agentRoute);

const subscriptionRoutes  = require('./api/routes/subscriptions.routes');
app.use("/api/v1/subscriptions/",subscriptionRoutes);


const chatRoutes  = require('./api/routes/chat.routes');
app.use("/api/v1/chat/",chatRoutes);


module.exports = app; // Export the configured app
