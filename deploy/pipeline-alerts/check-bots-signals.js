import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const botsSnap = await db.collection('bots').get();

console.log('=== ALL BOTS ===');
for (const doc of botsSnap.docs) {
  const data = doc.data();
  console.log(`\n[${doc.id}]`);
  console.log(`  Engine: ${data.engine || 'N/A'}`);
  console.log(`  Mode: ${data.desiredConfig?.mode || 'N/A'}`);
  console.log(`  Status: ${data.status || 'N/A'}`);

  // Check last signal
  const signalsSnap = await db.collection('bots').doc(doc.id).collection('signals')
    .orderBy('createdAt', 'desc').limit(1).get();

  if (!signalsSnap.empty) {
    const lastSignal = signalsSnap.docs[0].data();
    const assetClass = lastSignal.evaluation?.assetClass || lastSignal.data?.assetClass || 'unknown';
    const age = Date.now() - (lastSignal.createdAt?.toMillis?.() || 0);
    const ageMin = Math.round(age / 60000);
    console.log(`  Last signal: ${ageMin} min ago (${assetClass})`);
  } else {
    console.log(`  Last signal: NONE`);
  }
}

process.exit(0);
