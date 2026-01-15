import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

console.log('=== STOCK MOMENTUM DETAIL ===\n');

// Check price data
const pricesDoc = await db.doc('market/prices').get();
const priceItems = pricesDoc.data()?.items || [];
const stockPrices = priceItems.filter(i => i.assetClass === 'stock');

console.log('Stocks in market/prices:', stockPrices.length);
console.log('\nMomentum fields available:');
if (stockPrices.length > 0) {
  const sample = stockPrices[0];
  console.log('  Fields:', Object.keys(sample).join(', '));
  console.log('\n  Sample stock:', JSON.stringify(sample, null, 2));
}

// Check momentum distribution
console.log('\nMomentum distribution across all stocks:');
const momentumFields = ['change1m', 'change5m', 'change15m', 'change1h', 'change24h'];
momentumFields.forEach(field => {
  const hasValue = stockPrices.filter(s => typeof s[field] === 'number').length;
  const nonZero = stockPrices.filter(s => typeof s[field] === 'number' && s[field] !== 0).length;
  console.log(`  ${field}: ${hasValue}/${stockPrices.length} have value, ${nonZero} non-zero`);
});

// Check candidates
const candDoc = await db.doc('market/candidates').get();
const candItems = candDoc.data()?.items || [];
const stockCands = candItems.filter(i => i.assetClass === 'stock');

console.log('\n\nStocks in market/candidates:', stockCands.length);
if (stockCands.length > 0) {
  console.log('\nSample candidate:', JSON.stringify(stockCands[0], null, 2));
}

// Check score weights
const ctrlDoc = await db.doc('market/controls').get();
if (ctrlDoc.exists) {
  const data = ctrlDoc.data();
  console.log('\n\nTrend weights:', JSON.stringify(data.trendWeights, null, 2));
}

// Check market status
const psDoc = await db.doc('pipeline/price_streamer').get();
if (psDoc.exists) {
  console.log('\n\nMarket status:', JSON.stringify(psDoc.data()?.marketStatus, null, 2));
}

process.exit(0);
