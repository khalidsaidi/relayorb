import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const HORIZONS = { "1h": 60, "24h": 1440, "7d": 10080 };
const evalLookbackHours = 168;
const evalMaxSignals = 120;

const nowMs = Date.now();
const cutoff = new Date(nowMs - evalLookbackHours * 60 * 60 * 1000);
const minHorizonMinutes = Math.min(...Object.values(HORIZONS));
const eligibleBefore = new Date(nowMs - minHorizonMinutes * 60 * 1000);

console.log('Query window:');
console.log('  Cutoff (7d ago):', cutoff.toISOString());
console.log('  Eligible before (1h ago):', eligibleBefore.toISOString());
console.log('  Now:', new Date().toISOString());

const snap = await db
  .collectionGroup('signals')
  .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(cutoff))
  .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(eligibleBefore))
  .orderBy('createdAt', 'desc')
  .limit(evalMaxSignals)
  .get();

console.log('\nSignals in window:', snap.size);

if (snap.size > 0) {
  console.log('\nFirst 5 signals:');
  snap.docs.slice(0, 5).forEach((doc, i) => {
    const d = doc.data();
    const age = Math.round((nowMs - d.createdAt?.toMillis?.()) / 60000);
    console.log(`${i+1}. ${d.symbol} (${age}m old)`);
    console.log(`   Path: ${doc.ref.path}`);
    console.log(`   Has evaluation: ${!!d.evaluation}`);
  });

  // Try to write evaluation to one signal
  const testDoc = snap.docs[0];
  const testData = testDoc.data();
  console.log('\nAttempting test write to:', testDoc.ref.path);

  try {
    await testDoc.ref.set({
      evaluation: {
        assetClass: 'crypto',
        symbol: testData.symbol,
        evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
        horizons: {
          '1h': { returnPct: 0.5, hit: true, test: true }
        }
      }
    }, { merge: true });
    console.log('Write succeeded!');

    // Read it back
    const updated = await testDoc.ref.get();
    console.log('Read back evaluation:', JSON.stringify(updated.data().evaluation, null, 2));
  } catch (err) {
    console.log('Write failed:', err.message);
  }
}

process.exit(0);
