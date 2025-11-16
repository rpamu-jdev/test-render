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

const usersRoutes = require('./api/routes/users.routes');
app.use("/api/v1/users/",usersRoutes);

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

const userDeviceRoutes = require('./api/routes/userDevice.routes');
app.use('/api/v1/devices', userDeviceRoutes);

// Notification routes
const notificationRoutes = require('./api/routes/notification.routes');
app.use('/api/v1/notifications', notificationRoutes);

// const firebase_admin = require('./config/firebase')
// app.get('/test-fcm', async (req, res) => {
//   const token = 'c8Xy5rJARZ6MBSSCmUSbic:APA91bHed-P3yXzkRYCSVE9sMxf5KGlhgjeR__3H6k9R45BRpDl-Jng1VWaOGPiCBMq8SyUBRIxOHx-uCaz0-TDAhtxQJzKmNjk1K3qafyD0PFcRTDx8zpY'; // your provided token

//   const message = {
//     token: token,
//     notification: {
//       title: '🚀 Test Notification',
//       body: 'Hello from your Express + Firebase server!',
//     },
//     data: {
//       click_action: 'FLUTTER_NOTIFICATION_CLICK',
//       customKey: 'customValue'
//     }
//   };

//   try {
//     const response = await firebase_admin.messaging().send(message);
//     console.log('✅ Notification sent successfully:', response);
//     res.status(200).json({ success: true, response });
//   } catch (error) {
//     console.error('❌ Error sending notification:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });


//Mapple Token API
app.post('/api/v1/mapple-token', async (req, res) => {

  const clientKey    = 'ae2de8825746b7abb53971566518ceb7';
  const clientId     = '96dHZVzsAusBUy3f1rPPb4QB3ycBrVTa13VD79zdaIj17DgjGQ11H639cwkctXrELZLO2ICNY2SCrtIzOxMghg==';
  const clientSecret = 'lrFxI-iSEg_Od-U8rVvdtFSNTBZeY-3JB_icun1Fsde0wn3nuibxtFRTX1-ZxOwXYF0qOvB3VDWcWpCiDNkE1bmlO2IArWbz';

  res.status(200).json({client_key:clientKey,client_id:clientId,client_secret:clientSecret});
});


module.exports = app; 