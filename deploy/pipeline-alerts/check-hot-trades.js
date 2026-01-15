import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const htDoc = await db.doc('market/hotTrades').get();
const data = htDoc.data();

console.log('=== market/hotTrades STRUCTURE ===\n');

console.log('All keys:', Object.keys(data));

if (data.items) {
  if (Array.isArray(data.items)) {
    console.log('\nitems is array with', data.items.length, 'elements');
    if (data.items.length > 0) {
      console.log('Sample item:', JSON.stringify(data.items[0]).substring(0, 300));
    }
  } else if (typeof data.items === 'object') {
    console.log('\nitems is object with keys:', Object.keys(data.items).slice(0, 10));
  }
}

if (data.sources) {
  console.log('\nsources:', JSON.stringify(data.sources).substring(0, 200));
}

if (data.meta) {
  console.log('\nmeta:', JSON.stringify(data.meta).substring(0, 200));
}

// Check what the UI expects
console.log('\n=== WHAT UI EXPECTS vs WHAT EXISTS ===');
console.log('buy:', data.buy ? 'EXISTS' : 'MISSING');
console.log('sell:', data.sell ? 'EXISTS' : 'MISSING');

process.exit(0);
