import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const doc = await db.doc('market/hotTrades').get();
const data = doc.data();
console.log('Current hotTrades count:', data.items ? data.items.length : 0);
console.log('\nTop 15 Trades:');
if (data.items) {
  data.items.slice(0, 15).forEach((item, i) => {
    const score = item.score ? item.score.toFixed(2) : 'N/A';
    console.log(`${i+1}. ${item.symbol} (${item.assetClass}) - Score: ${score}`);
  });
}
process.exit(0);
