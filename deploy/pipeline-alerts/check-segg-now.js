import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const hotTrades = await db.doc('market/hotTrades').get();
if (hotTrades.exists) {
  const data = hotTrades.data();
  console.log('Hot trades updated:', data.updatedAt?.toDate?.());
  const items = data.items || [];
  const seggTrade = items.find(item => item.symbol === 'SEGG');
  if (seggTrade) {
    console.log('\n=== SEGG ===');
    console.log('Side:', seggTrade.side);
    console.log('Score:', seggTrade.score);
    console.log('Signals:', JSON.stringify(seggTrade.signals, null, 2));
    console.log('\nBot analysis:', seggTrade.analysis?.details?.find(d => d.includes('Bots:')));
  }
}

process.exit(0);
