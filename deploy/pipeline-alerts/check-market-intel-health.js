import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const health = await db.doc('services/market_intel').get();

console.log('=== MARKET-INTEL HEALTH ===');
if (health.exists) {
  const data = health.data();
  console.log('Status:', data.status);
  console.log('Run ID:', data.runId);
  console.log('Duration:', data.durationMs, 'ms');
  console.log('Heartbeat:', data.heartbeatAt?.toDate?.());
  console.log('\nFetch status:');
  console.log('- Crypto:', data.fetchStatus?.crypto);
  console.log('- Stock:', data.fetchStatus?.stock);
  console.log('- Forex:', data.fetchStatus?.forex);
} else {
  console.log('No market-intel health document');
}

process.exit(0);
