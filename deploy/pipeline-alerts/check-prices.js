import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const doc = await db.doc('market/prices').get();
const data = doc.data();

console.log('=== PRICES ===');
const items = data.items || [];
const stocks = items.filter(item => item.assetClass === 'stock');
const crypto = items.filter(item => item.assetClass === 'crypto');
const forex = items.filter(item => item.assetClass === 'forex');

console.log('Total:', items.length, 'items');
console.log('Stocks:', stocks.length, '| Crypto:', crypto.length, '| Forex:', forex.length);
console.log('Updated:', data.updatedAt?.toDate?.() || 'unknown');
console.log('\n=== STOCK PRICES ===');
stocks.slice(0, 30).forEach((item, i) => {
  const change = item.change5m !== undefined ? item.change5m.toFixed(2) + '%' : 'N/A';
  const vol = item.volume || 0;
  console.log((i+1) + '. ' + item.symbol + ' - Price: $' + item.price + ' Change: ' + change + ' Vol: ' + vol);
});

process.exit(0);
