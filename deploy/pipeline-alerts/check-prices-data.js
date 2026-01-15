import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

// Check price data
const priceDoc = await db.doc('market/prices').get();
if (priceDoc.exists) {
  const data = priceDoc.data();
  const age = Date.now() - (data.updatedAt?.toMillis?.() || 0);
  console.log('=== MARKET/PRICES ===');
  console.log('Updated:', Math.round(age/60000), 'min ago');
  console.log('Total symbols:', Object.keys(data.symbols || {}).length);

  // Sample some prices
  const symbols = data.symbols || {};
  const samples = ['AAPL', 'NVDA', 'MSFT', 'BTC/USD', 'ETH/USD'];
  console.log('\nSample prices:');
  samples.forEach(s => {
    if (symbols[s]) console.log('  ' + s + ':', symbols[s]);
  });
} else {
  console.log('market/prices NOT FOUND');
}

// Check price streamer health
const psDoc = await db.doc('pipeline/price_streamer').get();
if (psDoc.exists) {
  console.log('\n=== PRICE STREAMER ===');
  const data = psDoc.data();
  console.log('Status:', data.status);
} else {
  console.log('\npipeline/price_streamer NOT FOUND');
}

process.exit(0);
