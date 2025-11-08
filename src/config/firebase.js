const firebase_admin = require('firebase-admin');
const service_ccount = require('./serviceAccountKey.json');

try {
  
  firebase_admin.initializeApp({
    credential: firebase_admin.credential.cert(service_ccount)
  });
  console.log('✅ Firebase Admin SDK initialized successfully.');

} catch (error) {

    if (error.code === 'ENOENT') { 
      console.error('❌ FATAL ERROR: "serviceAccountKey.json" not found in src/config/');
      console.error('Please download your Firebase service account key and place it in the config folder.');
    } else {
      console.error('❌ Error initializing Firebase Admin SDK:', error.message);
    }
    process.exit(1); 

}

module.exports = firebase_admin;
