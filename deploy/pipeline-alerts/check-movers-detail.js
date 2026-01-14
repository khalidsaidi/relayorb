import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const doc = await db.doc('market/movers').get();
console.log('=== MOVERS DOCUMENT ===');
console.log('Exists:', doc.exists);
if (doc.exists) {
  const data = doc.data();
  console.log('Keys:', Object.keys(data));
  console.log('\nData:', JSON.stringify(data, null, 2));
}

process.exit(0);
