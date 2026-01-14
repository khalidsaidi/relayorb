import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const signals = await db.collection('bots').doc('market-intel').collection('signals')
  .orderBy('createdAt', 'desc').limit(1).get();

console.log('=== LATEST SIGNAL ===');
if (!signals.empty) {
  const data = signals.docs[0].data();
  console.log(JSON.stringify(data, null, 2));
} else {
  console.log('No signals found');
}

const hotTrades = await db.doc('market/hotTrades').get();
if (hotTrades.exists) {
  console.log('\n=== FIRST HOT TRADE ===');
  const items = hotTrades.data().items || [];
  if (items.length > 0) {
    console.log(JSON.stringify(items[0], null, 2));
  }
}

process.exit(0);
