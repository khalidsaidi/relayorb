import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

// Check verification results
const verDoc = await db.doc('alerts/last_verification').get();
if (verDoc.exists) {
  const data = verDoc.data();

  console.log('=== VERIFICATION STATUS ===');
  console.log('Overall:', data.overall);
  console.log('Total Checks:', data.checks.length);
  console.log('Total Alerts:', data.alerts.length);

  // Show all checks
  console.log('\n=== ALL CHECKS ===');
  data.checks.forEach(c => {
    console.log(`[${c.status}] ${c.category}/${c.name}: ${c.message}`);
  });

  if (data.alerts.length > 0) {
    console.log('\n=== ACTIVE ALERTS ===');
    data.alerts.forEach(a => {
      console.log(`[${a.severity}] ${a.message}`);
    });
  }
}

// Check market-intel health
const miDoc = await db.doc('pipeline/market_intel').get();
if (miDoc.exists) {
  const data = miDoc.data();
  console.log('\n=== MARKET-INTEL HEALTH ===');
  console.log('Status:', data.status);

  const ds = data.dataSources || {};
  for (const [name, source] of Object.entries(ds)) {
    const count = source.count || 0;
    const status = source.status || 'unknown';
    console.log(`  ${name}: ${status} (count: ${count})`);
    if (source.error) {
      console.log(`    ERROR: ${String(source.error).substring(0, 100)}`);
    }
  }
}

// Check pipeline status
const pipeDoc = await db.doc('pipeline/status').get();
if (pipeDoc.exists) {
  const data = pipeDoc.data();
  console.log('\n=== PIPELINE STATUS ===');
  console.log('Overall:', data.status);
  console.log('Summary:', JSON.stringify(data.summary));
}

process.exit(0);
