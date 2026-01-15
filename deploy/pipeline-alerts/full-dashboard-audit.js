import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

console.log('========== FULL DASHBOARD DATA AUDIT ==========\n');

const issues = [];
const warnings = [];

function ageMin(ts) {
  if (!ts) return null;
  const ms = ts.toMillis ? ts.toMillis() : ts;
  return Math.round((Date.now() - ms) / 60000);
}

// ============================================================
// 1. HOT TRADES - Used by: Dip Radar, Hot Trades card, Top Buys, Top Sells
// ============================================================
console.log('1. HOT TRADES (market/hotTrades)');
console.log('   Used by: Dip Radar, Hot Trades, Top Buys, Top Sells');
const htDoc = await db.doc('market/hotTrades').get();
if (htDoc.exists) {
  const data = htDoc.data();
  const items = data.items || [];
  console.log('   ✓ Document exists');
  console.log('   Updated:', ageMin(data.updatedAt), 'min ago');
  console.log('   Total items:', items.length);

  // By asset class
  const byAsset = { crypto: 0, stock: 0, forex: 0 };
  const bySide = { buy: 0, sell: 0, hold: 0 };
  items.forEach(i => {
    byAsset[i.assetClass] = (byAsset[i.assetClass] || 0) + 1;
    bySide[i.side] = (bySide[i.side] || 0) + 1;
  });
  console.log('   By asset:', JSON.stringify(byAsset));
  console.log('   By side:', JSON.stringify(bySide));

  // Check for dip opportunities (negative horizon changes)
  const withDip = items.filter(i => {
    const m = i.momentum || {};
    return (m.change15m < 0 || m.change1h < 0 || m.change24h < 0);
  });
  console.log('   Items with negative momentum (dip candidates):', withDip.length);

  if (items.length === 0) issues.push('HOT TRADES: Empty - no items');
  if (!byAsset.stock) warnings.push('HOT TRADES: No stocks');
  if (!byAsset.forex) warnings.push('HOT TRADES: No forex');
  if (!bySide.buy) warnings.push('HOT TRADES: No buy signals');
  if (!bySide.sell) warnings.push('HOT TRADES: No sell signals');
} else {
  issues.push('HOT TRADES: Document missing');
}

// ============================================================
// 2. TRENDING - Used by: Trending Now card
// ============================================================
console.log('\n2. TRENDING (market/trending)');
console.log('   Used by: Trending Now card');
const trendDoc = await db.doc('market/trending').get();
if (trendDoc.exists) {
  const data = trendDoc.data();
  console.log('   ✓ Document exists');
  console.log('   Updated:', ageMin(data.updatedAt), 'min ago');
  console.log('   Top-level keys:', Object.keys(data).join(', '));

  // Check byHorizon structure
  if (data.byHorizon) {
    const horizons = Object.keys(data.byHorizon);
    console.log('   Horizons:', horizons.join(', '));

    for (const h of horizons) {
      const bucket = data.byHorizon[h];
      const counts = {
        crypto: bucket.crypto?.length || 0,
        stock: bucket.stock?.length || 0,
        forex: bucket.forex?.length || 0,
      };
      console.log(`   ${h}:`, JSON.stringify(counts));
    }
  } else {
    warnings.push('TRENDING: No byHorizon data');
  }

  // Check weights
  if (data.weights) {
    console.log('   Weights:', JSON.stringify(data.weights));
  }
} else {
  issues.push('TRENDING: Document missing');
}

// ============================================================
// 3. POPULAR - Used by: suggestions
// ============================================================
console.log('\n3. POPULAR (market/popular)');
console.log('   Used by: Quick add suggestions');
const popDoc = await db.doc('market/popular').get();
if (popDoc.exists) {
  const data = popDoc.data();
  console.log('   ✓ Document exists');
  console.log('   Updated:', ageMin(data.updatedAt), 'min ago');
  console.log('   Items:', data.items?.length || 0);
} else {
  warnings.push('POPULAR: Document missing (optional)');
}

// ============================================================
// 4. UNIVERSE - Used by: Your Universe card
// ============================================================
console.log('\n4. UNIVERSE (market/universe)');
console.log('   Used by: Your Universe card');
const univDoc = await db.doc('market/universe').get();
if (univDoc.exists) {
  const data = univDoc.data();
  console.log('   ✓ Document exists');
  console.log('   Updated:', ageMin(data.updatedAt), 'min ago');

  const cryptoSyms = data.crypto?.symbols?.length || 0;
  const stockSyms = data.stocks?.symbols?.length || 0;
  const forexPairs = data.forex?.pairs?.length || 0;

  console.log('   Crypto symbols:', cryptoSyms, '(mode:', data.crypto?.mode || 'none', ')');
  console.log('   Stock symbols:', stockSyms, '(mode:', data.stocks?.mode || 'none', ')');
  console.log('   Forex pairs:', forexPairs, '(mode:', data.forex?.mode || 'none', ')');

  if (cryptoSyms === 0 && stockSyms === 0 && forexPairs === 0) {
    warnings.push('UNIVERSE: All symbol lists empty (may be intentional if using movers mode)');
  }
} else {
  issues.push('UNIVERSE: Document missing');
}

// ============================================================
// 5. CONTROLS - Used by: Settings panel
// ============================================================
console.log('\n5. CONTROLS (market/controls)');
console.log('   Used by: Settings panel');
const ctrlDoc = await db.doc('market/controls').get();
if (ctrlDoc.exists) {
  const data = ctrlDoc.data();
  console.log('   ✓ Document exists');
  console.log('   Asset focus:', JSON.stringify(data.assetFocus));
  console.log('   Risk profile:', data.riskProfile);
  console.log('   Dip horizon:', data.dipHorizon);
  console.log('   Hot trades limit:', data.hotTradesLimit);
  console.log('   LLM enabled:', data.enableLLM);
  console.log('   Trend weights:', JSON.stringify(data.trendWeights));
} else {
  warnings.push('CONTROLS: Document missing (will use defaults)');
}

// ============================================================
// 6. SIGNAL PERFORMANCE - Used by: Prediction Accuracy card
// ============================================================
console.log('\n6. SIGNAL PERFORMANCE (analytics/signalPerformance)');
console.log('   Used by: Prediction Accuracy card');
const perfDoc = await db.doc('analytics/signalPerformance').get();
if (perfDoc.exists) {
  const data = perfDoc.data();
  console.log('   ✓ Document exists');
  console.log('   Updated:', ageMin(data.updatedAt), 'min ago');
  console.log('   Total signals:', data.total);
  console.log('   Correct:', data.correct);
  console.log('   Accuracy:', data.accuracy ? (data.accuracy * 100).toFixed(1) + '%' : 'N/A');

  if (data.byBot) {
    console.log('   By bot:', Object.keys(data.byBot).join(', '));
  }
} else {
  warnings.push('SIGNAL PERFORMANCE: Document missing');
}

// ============================================================
// 7. BOTS - Used by: Online/Error/Offline counts, Bot Matrix
// ============================================================
console.log('\n7. BOTS (bots collection)');
console.log('   Used by: Online/Error/Offline cards, Bot Matrix');
const botsSnap = await db.collection('bots').get();
console.log('   Total bots:', botsSnap.size);

const botStats = { online: 0, error: 0, offline: 0, disabled: 0 };
const botDetails = [];
for (const doc of botsSnap.docs) {
  const data = doc.data();
  const hbAge = ageMin(data.heartbeatAt || data.lastHeartbeat);
  const sigAge = ageMin(data.lastSignalAt);

  if (data.disabled || data.status === 'removed') {
    botStats.disabled++;
    botDetails.push({ id: doc.id, status: 'disabled' });
  } else if (data.status === 'error' || data.lastError) {
    botStats.error++;
    botDetails.push({ id: doc.id, status: 'error', error: data.lastError?.substring(0, 50) });
  } else if (data.status === 'online' && hbAge !== null && hbAge < 10) {
    botStats.online++;
    botDetails.push({ id: doc.id, status: 'online', hbAge, sigAge });
  } else {
    botStats.offline++;
    botDetails.push({ id: doc.id, status: 'offline', hbAge });
  }
}
console.log('   Stats:', JSON.stringify(botStats));
botDetails.forEach(b => {
  const extra = b.hbAge !== undefined ? ` (hb: ${b.hbAge}m, sig: ${b.sigAge}m)` : '';
  console.log(`   - ${b.id}: ${b.status}${extra}`);
});

if (botStats.online === 0) issues.push('BOTS: No online bots');
if (botStats.error > 0) warnings.push(`BOTS: ${botStats.error} bot(s) in error state`);

// ============================================================
// 8. BOT EVENTS - Used by: Recent Event Stream
// ============================================================
console.log('\n8. BOT EVENTS (collectionGroup)');
console.log('   Used by: Recent Event Stream');
const eventsSnap = await db.collectionGroup('events')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();
console.log('   Recent events:', eventsSnap.size);
if (eventsSnap.size > 0) {
  const oldestAge = ageMin(eventsSnap.docs[eventsSnap.size - 1].data().createdAt);
  const newestAge = ageMin(eventsSnap.docs[0].data().createdAt);
  console.log(`   Age range: ${newestAge}m - ${oldestAge}m ago`);

  // Show event types
  const types = {};
  eventsSnap.docs.forEach(d => {
    const t = d.data().type || 'unknown';
    types[t] = (types[t] || 0) + 1;
  });
  console.log('   Event types:', JSON.stringify(types));
}

// ============================================================
// 9. SIGNALS - Used by: Signal Snapshot, Signal Radar
// ============================================================
console.log('\n9. SIGNALS (collectionGroup)');
console.log('   Used by: Signal Snapshot, Signal Radar');
const sigSnap = await db.collectionGroup('signals')
  .orderBy('createdAt', 'desc')
  .limit(50)
  .get();
console.log('   Recent signals (last 50):', sigSnap.size);

if (sigSnap.size > 0) {
  const byBot = {};
  const bySide = { buy: 0, sell: 0, hold: 0 };
  const byAsset = { crypto: 0, stock: 0, forex: 0 };

  sigSnap.docs.forEach(d => {
    const data = d.data();
    const botId = d.ref.parent.parent?.id || 'unknown';
    byBot[botId] = (byBot[botId] || 0) + 1;
    bySide[data.side] = (bySide[data.side] || 0) + 1;
    byAsset[data.assetClass] = (byAsset[data.assetClass] || 0) + 1;
  });

  console.log('   By bot:', JSON.stringify(byBot));
  console.log('   By side:', JSON.stringify(bySide));
  console.log('   By asset:', JSON.stringify(byAsset));

  const newestAge = ageMin(sigSnap.docs[0].data().createdAt);
  console.log('   Newest signal:', newestAge, 'min ago');

  if (newestAge > 30) warnings.push(`SIGNALS: Newest signal is ${newestAge}m old`);
}

// ============================================================
// 10. PRICES - Used by: Live price display
// ============================================================
console.log('\n10. PRICES (market/prices)');
console.log('   Used by: Live price display');
const pricesDoc = await db.doc('market/prices').get();
if (pricesDoc.exists) {
  const data = pricesDoc.data();
  const items = data.items || [];
  console.log('   ✓ Document exists');
  console.log('   Updated:', ageMin(data.updatedAt), 'min ago');
  console.log('   Total prices:', items.length);

  const byAsset = { crypto: 0, stock: 0, forex: 0 };
  items.forEach(i => byAsset[i.assetClass] = (byAsset[i.assetClass] || 0) + 1);
  console.log('   By asset:', JSON.stringify(byAsset));

  // Check for stale prices
  const age = ageMin(data.updatedAt);
  if (age > 5) warnings.push(`PRICES: Data is ${age}m old`);
} else {
  issues.push('PRICES: Document missing');
}

// ============================================================
// 11. PIPELINE HEALTH - Used by: Pipeline badges
// ============================================================
console.log('\n11. PIPELINE HEALTH');
console.log('   Used by: Pipeline status badges');
const pipelines = ['price_streamer', 'market_intel', 'activity_monitor'];
for (const name of pipelines) {
  const doc = await db.doc(`pipeline/${name}`).get();
  if (doc.exists) {
    const data = doc.data();
    const hbAge = ageMin(data.heartbeatAt);
    console.log(`   ${name}: status=${data.status}, hb=${hbAge}m ago`);
    if (data.status !== 'ok') warnings.push(`PIPELINE: ${name} status=${data.status}`);
    if (hbAge > 10) warnings.push(`PIPELINE: ${name} heartbeat stale (${hbAge}m)`);
  } else {
    warnings.push(`PIPELINE: ${name} health doc missing`);
  }
}

// ============================================================
// SUMMARY
// ============================================================
console.log('\n\n========== AUDIT SUMMARY ==========');

console.log('\nCRITICAL ISSUES (' + issues.length + '):');
if (issues.length === 0) {
  console.log('   None');
} else {
  issues.forEach((issue, i) => console.log('   ' + (i+1) + '. ' + issue));
}

console.log('\nWARNINGS (' + warnings.length + '):');
if (warnings.length === 0) {
  console.log('   None');
} else {
  warnings.forEach((w, i) => console.log('   ' + (i+1) + '. ' + w));
}

// Dashboard component status
console.log('\n========== DASHBOARD COMPONENT STATUS ==========');
const htItems = htDoc.exists ? (htDoc.data().items?.length || 0) : 0;
const htBySide = htDoc.exists ? htDoc.data().items?.reduce((acc, i) => { acc[i.side] = (acc[i.side] || 0) + 1; return acc; }, {}) : {};

console.log('1. Dip Radar: ' + (htItems > 0 ? '✓' : '✗') + ' (needs hot trades with negative momentum)');
console.log('2. Hot Trades: ' + (htItems > 0 ? '✓ ' + htItems + ' items' : '✗ empty'));
console.log('3. Trending Now: ' + (trendDoc.exists && trendDoc.data().byHorizon ? '✓' : '✗'));
console.log('4. Top Buys: ' + ((htBySide.buy || 0) > 0 ? '✓ ' + htBySide.buy : '✗ none'));
console.log('5. Top Sells: ' + ((htBySide.sell || 0) > 0 ? '✓ ' + htBySide.sell : '✗ none'));
console.log('6. Your Universe: ' + (univDoc.exists ? '✓' : '✗'));
console.log('7. Quick Actions: Static UI');
console.log('8. Signal Snapshot: ' + (sigSnap.size > 0 ? '✓ ' + sigSnap.size + ' recent' : '✗'));
console.log('9. Prediction Accuracy: ' + (perfDoc.exists ? '✓' : '✗ missing'));
console.log('10. Bot counts: ' + (botsSnap.size > 0 ? '✓ ' + botStats.online + ' online' : '✗'));
console.log('11. Event Stream: ' + (eventsSnap.size > 0 ? '✓ ' + eventsSnap.size + ' events' : '✗'));
console.log('12. Bot Matrix: ' + (botsSnap.size > 0 ? '✓' : '✗'));
console.log('13. Signal Radar: ' + (sigSnap.size > 0 ? '✓' : '✗'));

console.log('\n========== END AUDIT ==========');
process.exit(0);
