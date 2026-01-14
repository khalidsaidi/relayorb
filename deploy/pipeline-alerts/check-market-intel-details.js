import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const health = await db.doc('services/market_intel').get();

console.log('=== MARKET-INTEL SERVICE HEALTH ===');
if (health.exists) {
  const data = health.data();
  console.log('Status:', data.status);
  console.log('Run ID:', data.runId);
  console.log('Duration:', data.durationMs, 'ms');
  console.log('Heartbeat:', data.heartbeatAt?.toDate?.());
  
  if (data.dataSources) {
    console.log('\nData Sources:');
    console.log('- Crypto:', data.dataSources.crypto);
    console.log('- Stock:', data.dataSources.stock);
    console.log('- Forex:', data.dataSources.forex);
  }
  
  if (data.fetchStatus) {
    console.log('\nFetch Status:');
    console.log(JSON.stringify(data.fetchStatus, null, 2));
  }
} else {
  console.log('No health document found');
}

process.exit(0);
