import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const htDoc = await db.doc('market/hotTrades').get();
const items = htDoc.data().items || [];

console.log('=== HOT TRADES (SCORED) ===\n');
console.log('Total items:', items.length);

// Group by asset class
const byAsset = {};
items.forEach(i => {
  if (!byAsset[i.assetClass]) byAsset[i.assetClass] = [];
  byAsset[i.assetClass].push(i);
});

console.log('\nBy asset class:', Object.keys(byAsset).map(k => k + ':' + byAsset[k].length).join(', '));

// Show all items with scores
console.log('\nAll hot trades (sorted by score):');
items.sort((a,b) => (b.score || 0) - (a.score || 0));
items.forEach((i, idx) => {
  console.log((idx+1) + '. [' + i.assetClass + '] ' + i.symbol + ' ' + i.side + ' score=' + i.score);
});

// The key question: Why no stocks/forex?
// Let's check if the pipeline is even receiving stock/forex data
const candDoc = await db.doc('market/candidates').get();
const candItems = candDoc.data().items || [];
const candByAsset = {};
candItems.forEach(i => {
  if (!candByAsset[i.assetClass]) candByAsset[i.assetClass] = [];
  candByAsset[i.assetClass].push(i);
});

console.log('\n=== CANDIDATES (before scoring) ===');
console.log('Total:', candItems.length);
console.log('By asset:', Object.keys(candByAsset).map(k => k + ':' + candByAsset[k].length).join(', '));

// Check candidate price data (scoring needs prices for momentum)
console.log('\nSample stock candidate:');
const stockSample = candItems.find(i => i.assetClass === 'stock');
if (stockSample) {
  console.log(JSON.stringify(stockSample, null, 2));
}

process.exit(0);
