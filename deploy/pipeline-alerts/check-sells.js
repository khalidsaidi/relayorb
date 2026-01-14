import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const hotTrades = await db.doc('market/hotTrades').get();

console.log('=== HOT TRADES SUMMARY ===');
if (hotTrades.exists) {
  const data = hotTrades.data();
  console.log('Updated:', data.updatedAt?.toDate?.());
  const items = data.items || [];
  
  const buys = items.filter(i => i.side === 'buy');
  const sells = items.filter(i => i.side === 'sell');
  const holds = items.filter(i => i.side === 'hold');
  
  console.log('\nTotal items:', items.length);
  console.log('Buy signals:', buys.length);
  console.log('Sell signals:', sells.length);
  console.log('Hold signals:', holds.length);
  
  console.log('\n=== BUY SIGNALS ===');
  buys.forEach((item, i) => {
    const sigs = item.signals ? item.signals.buy + '/' + item.signals.sell : 'N/A';
    console.log(i+1 + '. ' + item.symbol + ' - Score: ' + item.score.toFixed(2) + ' - Sigs: ' + sigs);
  });
  
  console.log('\n=== SELL SIGNALS ===');
  sells.forEach((item, i) => {
    const sigs = item.signals ? item.signals.buy + '/' + item.signals.sell : 'N/A';
    console.log(i+1 + '. ' + item.symbol + ' - Score: ' + item.score.toFixed(2) + ' - Sigs: ' + sigs);
  });
}

process.exit(0);
