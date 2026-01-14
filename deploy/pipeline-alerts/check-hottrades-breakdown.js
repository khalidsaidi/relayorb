import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const doc = await db.doc('market/hotTrades').get();
if (doc.exists) {
  const data = doc.data();
  const items = data.items || [];
  const byCrypto = items.filter(i => i.assetClass === 'crypto');
  const byStock = items.filter(i => i.assetClass === 'stock');
  console.log('Total items:', items.length);
  console.log('Crypto:', byCrypto.length);
  console.log('Stock:', byStock.length);
  console.log('\nTop 12:');
  items.slice(0, 12).forEach((item, i) => {
    const score = typeof item.score === 'number' ? item.score.toFixed(1) : 'N/A';
    console.log(`  ${i+1}. [${item.assetClass}] ${item.symbol} - ${item.side} score:${score}`);
  });
}

process.exit(0);
