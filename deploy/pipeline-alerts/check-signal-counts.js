import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const bots = ['backtrader-stocks', 'backtrader-forex', 'backtrader-crypto', 'freqtrade-1', 'market-intel'];

console.log('=== SIGNAL COUNTS PER BOT ===');
for (const botId of bots) {
  const snap = await db.collection('bots').doc(botId).collection('signals').count().get();
  console.log(`${botId}: ${snap.data().count} signals`);
}

// Also check timestamps to understand ordering
console.log('\n=== LATEST SIGNAL TIMESTAMPS ===');
for (const botId of bots) {
  const snap = await db.collection('bots').doc(botId).collection('signals')
    .orderBy('createdAt', 'desc').limit(1).get();
  if (!snap.empty) {
    const ts = snap.docs[0].data().createdAt?.toDate?.()?.toISOString();
    console.log(`${botId}: ${ts}`);
  } else {
    console.log(`${botId}: NO SIGNALS`);
  }
}

process.exit(0);
