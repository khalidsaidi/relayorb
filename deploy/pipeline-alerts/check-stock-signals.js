import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const hotTrades = await db.doc('market/hotTrades').get();

if (hotTrades.exists) {
  const data = hotTrades.data();
  const items = data.items || [];
  const stocks = items.filter(i => i.assetClass === 'stock');
  
  console.log('=== STOCK SIGNALS ANALYSIS ===');
  console.log('Updated:', data.updatedAt?.toDate?.());
  console.log('Total stocks:', stocks.length);
  
  const noSignals = [];
  const hasSignals = [];
  
  stocks.forEach(item => {
    if (!item.signals || item.signals.total === 0 || item.signals.total === undefined) {
      noSignals.push(item.symbol);
    } else {
      hasSignals.push({
        symbol: item.symbol,
        total: item.signals.total,
        buy: item.signals.buy,
        sell: item.signals.sell
      });
    }
  });
  
  console.log('\nStocks WITH signals (' + hasSignals.length + '):');
  hasSignals.forEach((s, i) => {
    console.log(i+1 + '. ' + s.symbol + ' - ' + s.total + ' signals (' + s.buy + '/' + s.sell + ')');
  });
  
  console.log('\nStocks WITHOUT signals (' + noSignals.length + '):');
  console.log(noSignals.join(', '));
}

process.exit(0);
