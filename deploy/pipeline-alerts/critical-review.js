import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

console.log('========== CRITICAL DASHBOARD DATA REVIEW ==========\n');

// 1. Check hot trades data
console.log('1. HOT TRADES DATA');
const hotTradesDoc = await db.doc('market/hotTrades').get();
if (hotTradesDoc.exists) {
  const data = hotTradesDoc.data();
  const age = Date.now() - (data.updatedAt?.toMillis?.() || 0);
  console.log('   Last updated:', Math.round(age/60000), 'minutes ago');
  console.log('   Buy candidates:', data.buy?.length || 0);
  console.log('   Sell candidates:', data.sell?.length || 0);

  if (data.buy?.length > 0) {
    const sample = data.buy[0];
    console.log('   Sample buy:', sample.symbol, 'price:', sample.price, 'score:', sample.score?.toFixed(2));
  }
  if (data.sell?.length > 0) {
    const sample = data.sell[0];
    console.log('   Sample sell:', sample.symbol, 'price:', sample.price, 'score:', sample.score?.toFixed(2));
  }
} else {
  console.log('   ERROR: Hot trades document MISSING!');
}

// 2. Check market intel health
console.log('\n2. MARKET INTEL HEALTH');
const miDoc = await db.doc('pipeline/market_intel').get();
if (miDoc.exists) {
  const data = miDoc.data();
  console.log('   Status:', data.status);
  const ds = data.dataSources || {};
  for (const [name, source] of Object.entries(ds)) {
    const err = source.error ? ' ERROR: ' + String(source.error).substring(0,60) : '';
    console.log('     ' + name + ': ' + source.status + ' (count: ' + source.count + ')' + err);
  }
} else {
  console.log('   ERROR: Market intel health document MISSING!');
}

// 3. Check bot health
console.log('\n3. BOT HEALTH');
const botsSnap = await db.collection('bots').get();
for (const doc of botsSnap.docs) {
  const data = doc.data();
  if (data.disabled || data.status === 'removed') {
    console.log('   [' + doc.id + '] DISABLED/REMOVED');
    continue;
  }

  const heartbeatAge = Date.now() - (data.lastHeartbeat?.toMillis?.() || 0);
  const issues = [];

  if (heartbeatAge > 600000) issues.push('heartbeat stale (' + Math.round(heartbeatAge/60000) + 'm)');
  if (!data.engine) issues.push('no engine');
  if (data.status !== 'online') issues.push('status=' + data.status);

  console.log('   [' + doc.id + '] ' + (issues.length ? 'ISSUES: ' + issues.join(', ') : 'OK - ' + data.engine + '/' + data.desiredConfig?.mode));
}

// 4. Check signals freshness per bot
console.log('\n4. SIGNAL FRESHNESS');
const signalBots = ['backtrader-crypto', 'backtrader-stocks', 'backtrader-forex', 'market-intel'];
for (const botId of signalBots) {
  const snap = await db.collection('bots').doc(botId).collection('signals')
    .orderBy('createdAt', 'desc').limit(1).get();
  if (!snap.empty) {
    const age = Date.now() - (snap.docs[0].data().createdAt?.toMillis?.() || 0);
    const ageMin = Math.round(age/60000);
    const status = ageMin > 30 ? 'STALE' : 'OK';
    console.log('   [' + botId + '] Last signal: ' + ageMin + ' min ago - ' + status);
  } else {
    console.log('   [' + botId + '] NO SIGNALS');
  }
}

// 5. Check universe
console.log('\n5. TRADING UNIVERSE');
const universeDoc = await db.doc('market/universe').get();
if (universeDoc.exists) {
  const data = universeDoc.data();
  console.log('   Crypto:', (data.crypto?.length || 0) + ' symbols');
  console.log('   Stocks:', (data.stocks?.length || 0) + ' symbols');
  console.log('   Forex:', (data.forex?.length || 0) + ' symbols');
} else {
  console.log('   WARNING: Universe document not found');
}

// 6. Check for data inconsistencies
console.log('\n6. DATA CONSISTENCY CHECKS');

// Check if hot trades have valid prices
if (hotTradesDoc.exists) {
  const data = hotTradesDoc.data();
  const allTrades = [...(data.buy || []), ...(data.sell || [])];
  const missingPrices = allTrades.filter(t => !t.price || t.price <= 0);
  const missingScores = allTrades.filter(t => typeof t.score !== 'number');
  const missingAssetClass = allTrades.filter(t => !t.assetClass);

  if (missingPrices.length) console.log('   WARNING: ' + missingPrices.length + ' trades with missing/invalid price');
  if (missingScores.length) console.log('   WARNING: ' + missingScores.length + ' trades with missing score');
  if (missingAssetClass.length) console.log('   WARNING: ' + missingAssetClass.length + ' trades with missing assetClass');
  if (!missingPrices.length && !missingScores.length && !missingAssetClass.length) {
    console.log('   Hot trades data quality: OK');
  }
}

// 7. Check movers data
console.log('\n7. MOVERS DATA');
const moversDoc = await db.doc('market/movers').get();
if (moversDoc.exists) {
  const data = moversDoc.data();
  const age = Date.now() - (data.updatedAt?.toMillis?.() || 0);
  console.log('   Last updated:', Math.round(age/60000), 'min ago');
  console.log('   Gainers:', data.gainers?.length || 0);
  console.log('   Losers:', data.losers?.length || 0);
  console.log('   Most active:', data.mostActive?.length || 0);
} else {
  console.log('   WARNING: Movers document not found');
}

// 8. Check news data
console.log('\n8. NEWS DATA');
const newsDoc = await db.doc('market/news').get();
if (newsDoc.exists) {
  const data = newsDoc.data();
  const age = Date.now() - (data.updatedAt?.toMillis?.() || 0);
  console.log('   Last updated:', Math.round(age/60000), 'min ago');
  console.log('   Articles:', data.articles?.length || 0);
} else {
  console.log('   WARNING: News document not found');
}

console.log('\n========== END REVIEW ==========');
process.exit(0);
