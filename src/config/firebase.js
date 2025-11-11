const firebase_admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

function initFirebaseAdmin() {
  try {
    let app;

    if (fs.existsSync(serviceAccountPath)) {
      // ✅ Local development mode
      const serviceAccount = require(serviceAccountPath);
      firebase_admin.initializeApp({
        credential: firebase_admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin SDK initialized using serviceAccountKey.json');
      app = firebase_admin;
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      // ✅ Cloud / Environment variable mode
      firebase_admin.initializeApp({
        credential: firebase_admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase Admin SDK initialized using environment variables');
      app = firebase_admin;
    } else {
      // ⚠️ No credentials found, but do NOT crash
      console.warn(
        '⚠️ Firebase Admin SDK not initialized: No serviceAccountKey.json or environment variables found.'
      );
      console.warn('👉 Continuing without Firebase Admin (limited features may not work).');
      return null;
    }

    return app;
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    console.warn('👉 Continuing without Firebase Admin.');
    return null;
  }
}

// Export initialized or null
const firebaseApp = initFirebaseAdmin();
module.exports = firebaseApp;
