import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

console.log('========== HOT TRADES PIPELINE DIAGNOSTIC ==========\n');

// 1. Check market/prices - the source of all price/momentum data
console.log('1. PRICE DATA (market/prices)');
const pricesDoc = await db.doc('market/prices').get();
const pricesData = pricesDoc.exists ? pricesDoc.data() : null;
const priceItems = pricesData?.items || [];

// Group by asset class
const pricesByAsset = { crypto: [], stock: [], forex: [] };
priceItems.forEach(item => {
  if (pricesByAsset[item.assetClass]) {
    pricesByAsset[item.assetClass].push(item);
  }
});

console.log('   Total items:', priceItems.length);
console.log('   By asset:', Object.entries(pricesByAsset).map(([k,v]) => k + ':' + v.length).join(', '));

// Check momentum data availability
for (const [asset, items] of Object.entries(pricesByAsset)) {
  if (items.length === 0) continue;
  const withChange1m = items.filter(i => typeof i.change1m === 'number' && i.change1m !== 0).length;
  const withChange5m = items.filter(i => typeof i.change5m === 'number' && i.change5m !== 0).length;
  const zeroChange1m = items.filter(i => i.change1m === 0).length;
  const nullChange1m = items.filter(i => i.change1m === null || i.change1m === undefined).length;

  console.log(`\n   ${asset.toUpperCase()} momentum analysis (${items.length} items):`);
  console.log(`     Has non-zero change1m: ${withChange1m}`);
  console.log(`     Has non-zero change5m: ${withChange5m}`);
  console.log(`     Change1m is 0: ${zeroChange1m}`);
  console.log(`     Change1m is null/undefined: ${nullChange1m}`);

  if (items.length > 0) {
    console.log(`     Sample:`, items.slice(0, 2).map(i =>
      `${i.symbol} price=${i.price} change1m=${i.change1m} change5m=${i.change5m}`
    ));
  }
}

// 2. Check market/candidates - intermediate step
console.log('\n\n2. CANDIDATES (market/candidates)');
const candDoc = await db.doc('market/candidates').get();
const candItems = candDoc.exists ? candDoc.data()?.items || [] : [];

const candsByAsset = { crypto: [], stock: [], forex: [] };
candItems.forEach(item => {
  if (candsByAsset[item.assetClass]) {
    candsByAsset[item.assetClass].push(item);
  }
});

console.log('   Total candidates:', candItems.length);
console.log('   By asset:', Object.entries(candsByAsset).map(([k,v]) => k + ':' + v.length).join(', '));

// Check candidate momentum and scores
for (const [asset, items] of Object.entries(candsByAsset)) {
  if (items.length === 0) continue;
  const withScore = items.filter(i => typeof i.score === 'number').length;
  const withMomentum = items.filter(i =>
    typeof i.change1m === 'number' ||
    typeof i.change5m === 'number' ||
    typeof i.change15m === 'number'
  ).length;
  const avgScore = items.length > 0 ?
    items.reduce((sum, i) => sum + (i.score || 0), 0) / items.length : 0;

  console.log(`\n   ${asset.toUpperCase()} candidates (${items.length} items):`);
  console.log(`     With score: ${withScore}`);
  console.log(`     With momentum data: ${withMomentum}`);
  console.log(`     Average score: ${avgScore.toFixed(2)}`);

  // Show top 3 by score
  const sorted = [...items].sort((a,b) => (b.score || 0) - (a.score || 0));
  console.log(`     Top 3:`);
  sorted.slice(0, 3).forEach((item, i) => {
    console.log(`       ${i+1}. ${item.symbol} score=${item.score?.toFixed(2)} change1m=${item.change1m} change15m=${item.change15m}`);
  });
}

// 3. Check market/hotTrades - final output
console.log('\n\n3. HOT TRADES (market/hotTrades)');
const htDoc = await db.doc('market/hotTrades').get();
const htData = htDoc.exists ? htDoc.data() : null;
const htItems = htData?.items || [];

const htByAsset = { crypto: [], stock: [], forex: [] };
htItems.forEach(item => {
  if (htByAsset[item.assetClass]) {
    htByAsset[item.assetClass].push(item);
  }
});

console.log('   Total hot trades:', htItems.length);
console.log('   By asset:', Object.entries(htByAsset).map(([k,v]) => k + ':' + v.length).join(', '));

// Show hot trades details
for (const [asset, items] of Object.entries(htByAsset)) {
  if (items.length === 0) continue;
  console.log(`\n   ${asset.toUpperCase()} hot trades (${items.length} items):`);
  items.slice(0, 3).forEach((item, i) => {
    console.log(`     ${i+1}. ${item.symbol} score=${item.score?.toFixed(2)} side=${item.side}`);
  });
}

// 4. Compare crypto vs stock momentum
console.log('\n\n4. MOMENTUM COMPARISON');

const cryptoWithMomentum = pricesByAsset.crypto.filter(i =>
  typeof i.change1m === 'number' && i.change1m !== 0
);
const stockWithMomentum = pricesByAsset.stock.filter(i =>
  typeof i.change1m === 'number' && i.change1m !== 0
);

console.log('   Crypto with non-zero change1m:', cryptoWithMomentum.length, '/', pricesByAsset.crypto.length);
console.log('   Stock with non-zero change1m:', stockWithMomentum.length, '/', pricesByAsset.stock.length);

// 5. Check market/controls for any filtering
console.log('\n\n5. MARKET CONTROLS');
const ctrlDoc = await db.doc('market/controls').get();
if (ctrlDoc.exists) {
  const data = ctrlDoc.data();
  console.log('   Asset focus:', data.assetFocus || 'none (all assets)');
  console.log('   Hot trades limit:', data.hotTradesLimit || 'not set');
  console.log('   Risk profile:', data.riskProfile || 'not set');
}

// 6. Check pipeline health for market-intel
console.log('\n\n6. MARKET-INTEL HEALTH');
const miDoc = await db.doc('pipeline/market_intel').get();
if (miDoc.exists) {
  const data = miDoc.data();
  console.log('   Status:', data.status);
  console.log('   Candidate counts:', JSON.stringify(data.candidateCounts || {}));
  console.log('   Fetch status:', JSON.stringify(data.fetchStatus || {}));
  const age = Date.now() - (data.heartbeatAt?.toMillis?.() || 0);
  console.log('   Last heartbeat:', Math.round(age/60000), 'min ago');
}

// 7. ASSESSMENT
console.log('\n\n========== ASSESSMENT ==========');

const issues = [];

// Check if prices have momentum
if (pricesByAsset.stock.length > 0) {
  const stocksNoMomentum = pricesByAsset.stock.filter(i =>
    (i.change1m === 0 || i.change1m === null || i.change1m === undefined) &&
    (i.change5m === 0 || i.change5m === null || i.change5m === undefined)
  ).length;
  if (stocksNoMomentum > pricesByAsset.stock.length * 0.5) {
    issues.push(`CRITICAL: ${stocksNoMomentum}/${pricesByAsset.stock.length} stocks have no momentum data (change1m/change5m are 0 or null)`);
  }
}

// Check if candidates are being generated
if (candsByAsset.stock.length === 0 && pricesByAsset.stock.length > 0) {
  issues.push('WARNING: No stock candidates generated despite having stock prices');
}

// Check if stocks make it to hot trades
if (htByAsset.stock.length === 0 && candsByAsset.stock.length > 0) {
  issues.push('WARNING: No stocks in hot trades despite having stock candidates');
  // Check avg score comparison
  const cryptoAvg = candsByAsset.crypto.reduce((s,i) => s + (i.score||0), 0) / (candsByAsset.crypto.length || 1);
  const stockAvg = candsByAsset.stock.reduce((s,i) => s + (i.score||0), 0) / (candsByAsset.stock.length || 1);
  if (stockAvg < cryptoAvg * 0.5) {
    issues.push(`  -> Stock avg score (${stockAvg.toFixed(2)}) is much lower than crypto (${cryptoAvg.toFixed(2)}) - likely due to missing momentum data`);
  }
}

// Check forex
if (htByAsset.forex.length === 0) {
  if (pricesByAsset.forex.length === 0) {
    issues.push('INFO: No forex in hot trades because no forex prices are being streamed');
  } else if (candsByAsset.forex.length === 0) {
    issues.push('WARNING: No forex candidates generated despite having forex prices');
  }
}

if (issues.length === 0) {
  console.log('No critical issues detected');
} else {
  issues.forEach((issue, i) => console.log((i+1) + '. ' + issue));
}

console.log('\n========== END DIAGNOSTIC ==========');
process.exit(0);
