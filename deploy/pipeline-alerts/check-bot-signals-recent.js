import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

// Check backtrader-stocks signals
const backtraderStocks = await db.collection('bots').doc('backtrader-stocks').collection('signals')
  .where('createdAt', '>', fiveMinAgo)
  .orderBy('createdAt', 'desc')
  .limit(50)
  .get();

console.log('=== BACKTRADER-STOCKS (last 5 min) ===');
console.log('Total signals:', backtraderStocks.size);

const symbols = new Set();
backtraderStocks.docs.forEach(doc => {
  const d = doc.data();
  symbols.add(d.symbol);
});

console.log('Unique symbols:', symbols.size);
console.log('Symbols:', Array.from(symbols).slice(0, 20).join(', '));

// Check latest hot trade for one of these symbols
if (symbols.size > 0) {
  const testSymbol = Array.from(symbols)[0];
  const hotTrades = await db.doc('market/hotTrades').get();
  if (hotTrades.exists) {
    const items = hotTrades.data().items || [];
    const trade = items.find(i => i.symbol === testSymbol);
    console.log('\n=== ' + testSymbol + ' IN HOT TRADES ===');
    if (trade) {
      console.log('Signals field:', trade.signals);
      console.log('Analysis:', trade.analysis?.details?.find(d => d.includes('Bots:')));
    } else {
      console.log('Not in hot trades');
    }
  }
}

process.exit(0);
