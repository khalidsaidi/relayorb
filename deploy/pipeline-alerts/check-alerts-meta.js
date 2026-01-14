import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const alertsMeta = await db.doc('alerts/meta').get();

console.log('=== ALERTS META ===');
if (alertsMeta.exists) {
  const data = alertsMeta.data();
  console.log('Alert cooldown status:');
  for (const [key, val] of Object.entries(data)) {
    const lastSent = val.lastSentAt?.toDate?.();
    const elapsed = Date.now() - (val.lastSentAt?.toMillis?.() || 0);
    const minutes = Math.round(elapsed / 60000);
    console.log(' ', key, '- Last sent:', lastSent, '(', minutes, 'min ago)');
  }
} else {
  console.log('No alerts/meta document');
}

// Check config/alerts
const alertsConfig = await db.doc('config/alerts').get();
console.log('\n=== ALERTS CONFIG ===');
if (alertsConfig.exists) {
  console.log(JSON.stringify(alertsConfig.data(), null, 2));
} else {
  console.log('No config/alerts document');
}

process.exit(0);
