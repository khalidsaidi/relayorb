import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const doc = await db.doc('config/market').get();
if (doc.exists) {
  const data = doc.data();
  console.log('=== CRYPTO CONFIG ===');
  console.log(JSON.stringify(data.crypto, null, 2));
}

process.exit(0);
