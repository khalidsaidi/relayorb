import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

console.log('=== OLD SIGNALS CHECK ===\n');

const nowMs = Date.now();
const oneHourAgo = new Date(nowMs - 60 * 60 * 1000);
const lookbackHours = 24;
const cutoff = new Date(nowMs - lookbackHours * 60 * 60 * 1000);

console.log('Time window:');
console.log('  Cutoff (24h ago):', cutoff.toISOString());
console.log('  Eligible before (1h ago):', oneHourAgo.toISOString());
console.log('  Now:', new Date().toISOString());

// Query signals in the eligible window
const snap = await db.collectionGroup('signals')
  .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(cutoff))
  .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(oneHourAgo))
  .orderBy('createdAt', 'desc')
  .limit(20)
  .get();

console.log('\nSignals in eligible window:', snap.size);

if (snap.size > 0) {
  console.log('\nSample signals:');
  snap.docs.slice(0, 5).forEach((doc, i) => {
    const data = doc.data();
    const age = Math.round((nowMs - data.createdAt?.toMillis?.()) / 60000);
    const hasEval = data.evaluation && Object.keys(data.evaluation).length > 0;
    const horizons = data.evaluation?.horizons || {};

    console.log(`\n${i+1}. ${data.symbol}`);
    console.log('   Age:', age, 'min');
    console.log('   Side:', data.side);
    console.log('   Has evaluation:', hasEval);
    if (hasEval) {
      console.log('   Horizon keys:', Object.keys(horizons).join(', '));
      const h1 = horizons['1h'];
      if (h1) {
        console.log('   1h return:', h1.returnPct?.toFixed(2) + '%', '| hit:', h1.hit);
      }
    }
  });

  // Count how many have evaluation
  let withEval = 0;
  let withoutEval = 0;
  let with1h = 0;

  snap.docs.forEach(doc => {
    const data = doc.data();
    const horizons = data.evaluation?.horizons || {};
    if (Object.keys(horizons).length > 0) {
      withEval++;
      if (horizons['1h']?.returnPct !== undefined) with1h++;
    } else {
      withoutEval++;
    }
  });

  console.log('\n\nSummary:');
  console.log('  With evaluation:', withEval);
  console.log('  Without evaluation:', withoutEval);
  console.log('  With 1h horizon evaluated:', with1h);

  if (withoutEval > 0) {
    console.log('\n⚠️  Some signals in window lack evaluation!');
  }
  if (withEval === snap.size && with1h === snap.size) {
    console.log('\n✓ All signals in window already have 1h evaluation - explains skipping');
  }
}

process.exit(0);
