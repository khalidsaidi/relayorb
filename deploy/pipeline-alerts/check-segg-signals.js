import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const sixHoursAgo = new Date(Date.now() - 360 * 60 * 1000);

// Check market-intel signals
const signals = await db.collection('bots').doc('market-intel').collection('signals')
  .where('symbol', '==', 'SEGG')
  .where('createdAt', '>', sixHoursAgo)
  .orderBy('createdAt', 'desc')
  .get();

console.log('=== SEGG MARKET-INTEL SIGNALS (last 360 min) ===');
console.log('Count:', signals.size);
signals.docs.forEach((doc, i) => {
  const d = doc.data();
  console.log(i+1 + '. ' + d.side + ' (strength: ' + d.strength + ') @ ' + d.createdAt.toDate());
});

// Check all bot signals for SEGG
const allBots = await db.collectionGroup('signals')
  .where('symbol', '==', 'SEGG')
  .where('createdAt', '>', sixHoursAgo)
  .orderBy('createdAt', 'desc')
  .get();

console.log('\n=== ALL BOT SIGNALS FOR SEGG (last 360 min) ===');
console.log('Total count:', allBots.size);
const byBot = {};
allBots.docs.forEach((doc) => {
  const botId = doc.ref.parent.parent.id;
  byBot[botId] = (byBot[botId] || 0) + 1;
});
console.log('By bot:', JSON.stringify(byBot, null, 2));

// Show first few signals
allBots.docs.slice(0, 10).forEach((doc, i) => {
  const d = doc.data();
  const botId = doc.ref.parent.parent.id;
  const side = d.side || d.signal || 'unknown';
  console.log(i+1 + '. Bot: ' + botId + ' - ' + side + ' @ ' + d.createdAt.toDate());
});

process.exit(0);
