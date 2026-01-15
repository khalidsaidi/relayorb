import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

console.log('=== SIGNAL EVALUATION CHECK ===\n');

// Check if signals have evaluation data
const sigSnap = await db.collectionGroup('signals')
  .orderBy('createdAt', 'desc')
  .limit(20)
  .get();

console.log('Checking 20 recent signals for evaluation data:');

let withEval = 0;
let withoutEval = 0;

sigSnap.docs.forEach((doc, i) => {
  const data = doc.data();
  const hasEval = data.evaluation && Object.keys(data.evaluation).length > 0;
  if (hasEval) withEval++;
  else withoutEval++;

  if (i < 5) {
    console.log(`\n${i+1}. Symbol: ${data.symbol}`);
    console.log('   Has evaluation:', hasEval);
    if (hasEval) {
      console.log('   Evaluation keys:', Object.keys(data.evaluation).join(', '));
    }
    console.log('   All keys:', Object.keys(data).join(', '));
  }
});

console.log('\n\nSummary:');
console.log('With evaluation:', withEval, '/', sigSnap.size);
console.log('Without evaluation:', withoutEval, '/', sigSnap.size);

if (withoutEval === sigSnap.size) {
  console.log('\n⚠️  NO signals have evaluation data!');
  console.log('   The signal-evaluator job may not be running.');
}

// Check signal-evaluator health
console.log('\n\n=== SIGNAL EVALUATOR HEALTH ===');
const evalDoc = await db.doc('pipeline/signal_evaluator').get();
if (evalDoc.exists) {
  const data = evalDoc.data();
  console.log('Status:', data.status);
  console.log('Last run:', data.heartbeatAt?.toDate?.()?.toISOString?.());
  console.log('Signals evaluated:', data.signalsEvaluated);
} else {
  console.log('⚠️  pipeline/signal_evaluator document NOT FOUND');
}

process.exit(0);
