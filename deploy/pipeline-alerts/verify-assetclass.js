import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const snap = await db.collectionGroup('signals')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();

console.log('Recent signals:');
let withAssetClass = 0;
let nullAssetClass = 0;

snap.docs.forEach((doc, i) => {
  const d = doc.data();
  const createdAt = d.createdAt?.toDate?.()?.toISOString();
  if (d.assetClass && d.assetClass !== null) {
    withAssetClass++;
  } else {
    nullAssetClass++;
  }
  console.log(`${i+1}. ${d.symbol} | assetClass: ${d.assetClass} | botId: ${d.botId} | ${createdAt}`);
});

console.log('\nSummary:');
console.log('  With assetClass:', withAssetClass);
console.log('  Null assetClass:', nullAssetClass);
process.exit(0);
