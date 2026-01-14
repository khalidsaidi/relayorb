import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

// This is what SignalsPage uses - collectionGroup
const snap = await db.collectionGroup('signals')
  .orderBy('createdAt', 'desc')
  .limit(50)
  .get();

console.log('=== COLLECTION GROUP QUERY RESULTS ===');
console.log('Total docs:', snap.size);

const byBot = {};
const byAssetClass = {};

for (const doc of snap.docs) {
  const data = doc.data();
  const botId = doc.ref.parent.parent?.id || 'unknown';
  const assetClass = data.evaluation?.assetClass || data.data?.assetClass || 'unknown';

  byBot[botId] = (byBot[botId] || 0) + 1;
  byAssetClass[assetClass] = (byAssetClass[assetClass] || 0) + 1;
}

console.log('\nBy Bot:', byBot);
console.log('By AssetClass:', byAssetClass);

process.exit(0);
