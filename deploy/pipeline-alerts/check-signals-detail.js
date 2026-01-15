import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

console.log('=== SIGNALS DETAIL CHECK ===\n');

// Check recent signals
const sigSnap = await db.collectionGroup('signals')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();

console.log('Sample signals:');
sigSnap.docs.forEach((doc, i) => {
  const data = doc.data();
  const botId = doc.ref.parent.parent?.id || 'unknown';
  console.log(`\n${i+1}. Bot: ${botId}`);
  console.log('   Symbol:', data.symbol);
  console.log('   Side:', data.side);
  console.log('   assetClass:', data.assetClass);
  console.log('   All keys:', Object.keys(data).join(', '));
});

// Check signal performance doc
console.log('\n\n=== SIGNAL PERFORMANCE DOC ===');
const perfDoc = await db.doc('analytics/signalPerformance').get();
if (perfDoc.exists) {
  const data = perfDoc.data();
  console.log('All keys:', Object.keys(data).join(', '));
  console.log('\nFull data:', JSON.stringify(data, null, 2));
}

// Check bot online status
console.log('\n\n=== BOT ONLINE STATUS ===');
const botsSnap = await db.collection('bots').get();
for (const doc of botsSnap.docs) {
  const data = doc.data();
  if (data.disabled) continue;
  console.log(`\n${doc.id}:`);
  console.log('   online:', data.online);
  console.log('   status:', data.status);
  console.log('   heartbeatAt:', data.heartbeatAt?.toDate?.()?.toISOString?.() || data.lastHeartbeat?.toDate?.()?.toISOString?.());
  console.log('   lastSignalAt:', data.lastSignalAt?.toDate?.()?.toISOString?.());
  console.log('   engine:', data.engine);
}

process.exit(0);
