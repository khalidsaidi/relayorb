const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({
  credential: cert(require('./relayorb-firebase-service-account.json'))
});
const db = getFirestore(app);

async function check() {
  console.log('=== ALERTS META (cooldown tracking) ===');
  const meta = await db.doc('alerts/meta').get();
  if (meta.exists) {
    const data = meta.data();
    Object.keys(data).forEach(key => {
      const lastSent = data[key]?.lastSentAt?.toDate?.();
      const elapsed = lastSent ? Math.round((Date.now() - lastSent.getTime()) / 1000 / 60) : 'N/A';
      console.log(`  ${key}: last sent ${elapsed} min ago`);
    });
  } else {
    console.log('No alerts/meta document - no alerts ever sent');
  }

  console.log('\n=== CONFIG/ALERTS (recipients) ===');
  const config = await db.doc('config/alerts').get();
  if (config.exists) {
    console.log(JSON.stringify(config.data(), null, 2));
  } else {
    console.log('No config/alerts document - recipients not configured');
  }

  process.exit(0);
}
check().catch(e => { console.error(e.message); process.exit(1); });
