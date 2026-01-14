import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const hotTrades = await db.doc('market/hotTrades').get();
if (hotTrades.exists) {
  const items = hotTrades.data().items || [];
  const seggTrade = items.find(item => item.symbol === 'SEGG');
  if (seggTrade) {
    console.log('=== SEGG HOT TRADE ===');
    console.log(JSON.stringify(seggTrade, null, 2));
  }
}

process.exit(0);
