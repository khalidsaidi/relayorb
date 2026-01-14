import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const doc = await db.doc('config/market').get();
console.log('Document exists:', doc.exists);
if (doc.exists) {
  const data = doc.data();
  console.log('Full config:', JSON.stringify(data, null, 2));
} else {
  console.log('config/market document does not exist');
}

process.exit(0);
