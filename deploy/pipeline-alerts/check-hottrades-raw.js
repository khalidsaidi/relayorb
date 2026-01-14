import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const hotTrades = await db.doc('market/hotTrades').get();

if (hotTrades.exists) {
  const data = hotTrades.data();
  console.log('Updated:', data.updatedAt?.toDate?.());
  console.log('Run ID:', data.runId);
  console.log('Total items:', data.items?.length);
  
  if (data.items && data.items.length > 0) {
    console.log('\n=== FIRST ITEM (RAW) ===');
    console.log(JSON.stringify(data.items[0], null, 2));
  }
}

process.exit(0);
