import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const lastVerification = await db.doc('alerts/last_verification').get();

console.log('=== LAST VERIFICATION ===');
if (lastVerification.exists) {
  const data = lastVerification.data();
  console.log('Run at:', data.runAt?.toDate?.());
  console.log('Overall:', data.overall);
  console.log('Timestamp:', new Date(data.timestamp));
  
  console.log('\nChecks (' + data.checks.length + '):');
  data.checks.forEach((check, i) => {
    console.log(i+1 + '. [' + check.category + '] ' + check.name + ' - ' + check.status);
  });
  
  console.log('\nAlerts (' + data.alerts.length + '):');
  data.alerts.forEach((alert, i) => {
    console.log(i+1 + '. [' + alert.severity + '] [' + alert.category + '] ' + alert.name + ': ' + alert.message);
  });
} else {
  console.log('No last verification document');
}

process.exit(0);
