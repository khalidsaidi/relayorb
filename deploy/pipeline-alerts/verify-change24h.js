import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const doc = await db.doc('market/prices').get();
if (!doc.exists) {
  console.log('NO PRICES DOC');
  process.exit(0);
}

const data = doc.data();
const items = data.items || [];
console.log('Total items:', items.length);

const withChange24h = items.filter(i => typeof i.change24h === 'number');
console.log('With change24h:', withChange24h.length);

const stocks = items.filter(i => i.assetClass === 'stock');
console.log('\nStocks:', stocks.length);
if (stocks.length > 0) {
  const sample = stocks[0];
  console.log('Sample stock:', sample.symbol);
  console.log('  Keys:', Object.keys(sample).join(', '));
  console.log('  change24h:', sample.change24h);
  console.log('  change1m:', sample.change1m);
  console.log('  change5m:', sample.change5m);
}

const crypto = items.filter(i => i.assetClass === 'crypto');
console.log('\nCrypto:', crypto.length);
if (crypto.length > 0) {
  const sample = crypto[0];
  console.log('Sample crypto:', sample.symbol);
  console.log('  change24h:', sample.change24h);
  console.log('  change1m:', sample.change1m);
}

process.exit(0);
