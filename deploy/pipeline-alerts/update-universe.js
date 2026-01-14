import admin from 'firebase-admin';

admin.initializeApp({
  projectId: 'relayorb'
});

const db = admin.firestore();

async function updateUniverse() {
  try {
    const universeRef = db.doc('market/universe');

    await universeRef.update({
      'stocks.mode': 'movers_plus_universe'
    });

    console.log('✅ Updated stocks.mode to "movers_plus_universe"');

    // Verify the update
    const doc = await universeRef.get();
    const data = doc.data();
    console.log('\nCurrent configuration:');
    console.log('  stocks.mode:', data.stocks.mode);
    console.log('  stocks.symbols:', data.stocks.symbols);
    console.log('  stocks.includeTrending:', data.stocks.includeTrending);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

updateUniverse();
