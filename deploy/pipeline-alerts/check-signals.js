import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const [hotTrades, signals] = await Promise.all([
  db.doc('market/hotTrades').get(),
  db.collection('bots').doc('market-intel').collection('signals').orderBy('createdAt', 'desc').limit(10).get()
]);

console.log('=== HOT TRADES ===');
if (hotTrades.exists) {
  const data = hotTrades.data();
  console.log('Updated:', data.updatedAt?.toDate?.());
  console.log('Total:', data.items?.length || 0);
  const items = data.items || [];
  items.slice(0, 10).forEach((item, i) => {
    const score = item.score ? item.score.toFixed(2) : 'N/A';
    console.log(i+1 + '. ' + item.symbol + ' (' + item.assetClass + ') - Signal: ' + item.signal + ' - Score: ' + score);
  });
} else {
  console.log('Not found');
}

console.log('\n=== MARKET-INTEL SIGNALS ===');
console.log('Total signals:', signals.size);
signals.docs.slice(0, 10).forEach((doc, i) => {
  const d = doc.data();
  console.log(i+1 + '. ' + d.symbol + ' - ' + d.signal + ' @ ' + d.createdAt?.toDate?.());
});

process.exit(0);
