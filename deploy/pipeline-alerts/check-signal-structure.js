import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

// Check signals from each bot
const bots = ['backtrader-stocks', 'backtrader-forex', 'backtrader-crypto'];
for (const botId of bots) {
  const snap = await db.collection('bots').doc(botId).collection('signals')
    .orderBy('createdAt', 'desc').limit(3).get();
  console.log("\n=== " + botId + " signals ===");
  for (const doc of snap.docs) {
    const data = doc.data();
    console.log({
      id: doc.id,
      side: data.side,
      symbol: data.symbol || data.data?.symbol || data.data?.pair,
      assetClass: data.evaluation?.assetClass || data.data?.assetClass,
      createdAt: data.createdAt?.toDate?.()?.toISOString()
    });
  }
}
process.exit(0);
