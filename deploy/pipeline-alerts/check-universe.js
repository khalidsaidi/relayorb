import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const doc = await db.doc('market/universe').get();
const data = doc.data();

console.log('=== UNIVERSE CONFIGURATION ===');
console.log('Mode:', data.mode);
console.log('Stocks mode:', data.stocks?.mode);
console.log('Stocks count:', data.stocks?.symbols?.length || 0);
console.log('Stocks:', data.stocks?.symbols?.join(', ') || 'none');

process.exit(0);
