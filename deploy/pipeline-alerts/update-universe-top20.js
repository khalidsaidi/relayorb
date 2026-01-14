import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const top20Stocks = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',
  'TSLA', 'META', 'AMD', 'NFLX', 'DIS',
  'BABA', 'INTC', 'COIN', 'PLTR', 'SOFI',
  'NIO', 'RIVN', 'LCID', 'F', 'GM'
];

console.log('Updating universe to top 20 stocks:', top20Stocks.join(', '));

await db.doc('market/universe').update({
  'stocks.symbols': top20Stocks,
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
});

console.log('Universe updated successfully to ' + top20Stocks.length + ' stocks');
process.exit(0);
