import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const doc = await db.doc('alerts/last_verification').get();
if (doc.exists) {
  const data = doc.data();
  console.log('=== PIPELINE VERIFICATION RESULTS ===');
  console.log('Run At:', data.runAt?.toDate?.());
  console.log('Overall Status:', data.overall);
  console.log('Total Checks:', data.checks.length);
  console.log('Total Alerts:', data.alerts.length);
  console.log('\nAll Checks:');
  data.checks.forEach(c => {
    const status = c.status === 'passed' ? 'PASS' : c.status === 'warning' ? 'WARN' : 'FAIL';
    console.log(`  [${status}] ${c.category}/${c.name}`);
    console.log(`      ${c.message}`);
    if (c.details && Object.keys(c.details).length > 0) {
      console.log(`      Details:`, JSON.stringify(c.details));
    }
  });
  
  if (data.alerts.length > 0) {
    console.log('\n=== ACTIVE ALERTS ===');
    data.alerts.forEach(a => {
      console.log(`  [${a.severity}] ${a.category}/${a.name}: ${a.message}`);
    });
  } else {
    console.log('\n=== NO ACTIVE ALERTS ===');
  }
}

process.exit(0);
