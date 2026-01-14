import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const pipelineStatus = await db.doc('pipeline/status').get();

console.log('=== PIPELINE STATUS ===');
if (pipelineStatus.exists) {
  const data = pipelineStatus.data();
  console.log('Status:', data.status);
  console.log('Updated:', data.updatedAt?.toDate?.());
  console.log('Summary:', data.summary);
  console.log('\nServices:');
  const services = data.services || {};
  for (const [name, svc] of Object.entries(services)) {
    const age = Math.round((svc.ageMs || 0) / 60000);
    console.log(' ', name + ':', svc.status, '(last seen', age, 'min ago)');
  }
} else {
  console.log('Pipeline status document not found');
}

process.exit(0);
