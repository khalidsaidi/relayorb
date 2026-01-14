import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const doc = await db.doc('market/prices').get();
const data = doc.data();

console.log('=== PRICES DOCUMENT ===');
console.log('Exists:', doc.exists);
if (doc.exists) {
  console.log('Items count:', data.items?.length || 0);
  console.log('Meta:', JSON.stringify(data.meta, null, 2));
  console.log('Updated:', data.updatedAt?.toDate?.().toISOString() || data.updatedAt);
  console.log('\nFirst 5 items:');
  (data.items || []).slice(0, 5).forEach(item => {
    console.log(`- ${item.symbol} (${item.assetClass}): ${item.price}`);
  });
}

process.exit(0);
