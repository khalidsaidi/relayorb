import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const sixHoursAgo = new Date(Date.now() - 360 * 60 * 1000);

// Check backtrader-stocks bot for SEGG
const backtraderStocks = await db.collection('bots').doc('backtrader-stocks').collection('signals')
  .where('createdAt', '>', sixHoursAgo)
  .orderBy('createdAt', 'desc')
  .limit(100)
  .get();

console.log('=== BACKTRADER-STOCKS SIGNALS (last 360 min) ===');
console.log('Total signals:', backtraderStocks.size);

const seggSignals = backtraderStocks.docs.filter(doc => doc.data().symbol === 'SEGG');
console.log('SEGG signals:', seggSignals.length);
seggSignals.forEach((doc, i) => {
  const d = doc.data();
  const side = d.side || d.signal || 'unknown';
  console.log(i+1 + '. ' + side + ' @ ' + d.createdAt.toDate());
});

// Check hot trades for SEGG
const hotTrades = await db.doc('market/hotTrades').get();
if (hotTrades.exists) {
  const items = hotTrades.data().items || [];
  const seggTrade = items.find(item => item.symbol === 'SEGG');
  console.log('\n=== SEGG IN HOT TRADES ===');
  if (seggTrade) {
    console.log('Found!');
    console.log('Side:', seggTrade.side);
    console.log('Score:', seggTrade.score);
    console.log('Bot signals:', seggTrade.signals);
  } else {
    console.log('Not in hot trades');
  }
}

process.exit(0);
