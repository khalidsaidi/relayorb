import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const health = await db.doc('pipeline/market_intel').get();

console.log('=== MARKET-INTEL HEALTH (pipeline/market_intel) ===');
if (health.exists) {
  const data = health.data();
  console.log('Status:', data.status);
  console.log('Run ID:', data.runId);
  console.log('Duration:', data.durationMs, 'ms');
  console.log('Started:', data.startedAt);
  console.log('Ended:', data.endedAt);
  console.log('Heartbeat:', data.heartbeatAt?.toDate?.());
  
  if (data.dataSources) {
    console.log('\nData Sources:');
    console.log(JSON.stringify(data.dataSources, null, 2));
  }
} else {
  console.log('No health document found');
}

process.exit(0);
