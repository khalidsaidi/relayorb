import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const candDoc = await db.doc('market/candidates').get();
const items = candDoc.data().items || [];

// Sort by score and show top items by asset class
const byAsset = {crypto: [], stock: [], forex: []};
items.forEach(i => {
  if (byAsset[i.assetClass]) byAsset[i.assetClass].push(i);
});

console.log('=== TOP CANDIDATES BY ASSET CLASS ===\n');

for (const [asset, list] of Object.entries(byAsset)) {
  list.sort((a,b) => (b.score || 0) - (a.score || 0));
  console.log(asset.toUpperCase() + ' (' + list.length + ' total):');
  list.slice(0, 3).forEach((i, idx) => {
    const score = typeof i.score === 'number' ? i.score.toFixed(2) : 'N/A';
    console.log('  ' + (idx+1) + '. ' + i.symbol + ' score=' + score + ' price=' + i.price);
  });
  console.log();
}

// Check if stocks/forex are being scored
const unscored = items.filter(i => typeof i.score !== 'number');
console.log('Unscored items:', unscored.length);
if (unscored.length > 0) {
  console.log('Unscored asset classes:', [...new Set(unscored.map(i => i.assetClass))]);
}

process.exit(0);
