import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

const doc = await db.doc('market/movers').get();
const data = doc.data();

console.log('=== STOCK MOVERS ===');
const stockGainers = data.markets?.us?.gainers || [];
console.log('Found ' + stockGainers.length + ' stock gainers\n');
stockGainers.slice(0, 10).forEach((item, i) => {
  const changePct = item.change15m ? item.change15m.toFixed(2) + '%' : 'N/A';
  const vol = item.volume || 'N/A';
  console.log((i+1) + '. ' + item.symbol + ' - Change: ' + changePct + ' Vol: ' + vol);
});

console.log('\n=== CRYPTO MOVERS ===');
const cryptoGainers = data.markets?.crypto?.gainers || [];
console.log('Found ' + cryptoGainers.length + ' crypto gainers');
process.exit(0);
