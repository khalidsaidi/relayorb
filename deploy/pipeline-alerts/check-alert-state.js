import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const alertState = await db.doc('system/alert_state').get();

console.log('=== ALERT STATE ===');
if (alertState.exists) {
  const data = alertState.data();
  console.log('Last run:', data.lastRun?.toDate?.());
  console.log('Status:', data.status);
  console.log('\nLast alerts sent:');
  if (data.lastAlertSent) {
    for (const [key, val] of Object.entries(data.lastAlertSent)) {
      console.log(' ', key, ':', new Date(val));
    }
  }
  console.log('\nLast checks:');
  if (data.lastChecks) {
    console.log(JSON.stringify(data.lastChecks, null, 2));
  }
} else {
  console.log('Alert state document not found');
}

process.exit(0);
