const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({
  credential: cert(require('./relayorb-firebase-service-account.json'))
});
const db = getFirestore(app);

async function check() {
  // Test the exact query the frontend uses
  console.log('=== TESTING COLLECTION GROUP QUERY ===');
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  try {
    const snap = await db.collectionGroup('signals')
      .where('symbol', '==', 'TSLA')
      .where('createdAt', '>=', cutoff)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    console.log('Query SUCCESS! Found', snap.size, 'signals for TSLA');
    snap.docs.forEach(doc => {
      const d = doc.data();
      console.log(' -', d.side, d.strength, d.createdAt?.toDate?.());
    });
  } catch (err) {
    console.log('Query FAILED:', err.code, err.message);
  }
  
  process.exit(0);
}
check().catch(e => { console.error(e.message); process.exit(1); });
