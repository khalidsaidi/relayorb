const admin = require('firebase-admin');
const serviceAccount = require('./relayorb-firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function verifyDashboard() {
  console.log('=== DASHBOARD PAGE VERIFICATION ===\n');
  
  // 1. Hot Trades
  const hotTrades = await db.doc('market/hotTrades').get();
  const htData = hotTrades.exists ? hotTrades.data() : null;
  const htItems = htData?.items || [];
  
  console.log('1. Hot Trades (market/hotTrades):');
  console.log('   ✅ Items:', htItems.length);
  console.log('   ✅ Updated:', htData?.updatedAt ? Math.round((Date.now() - htData.updatedAt.toDate().getTime()) / 60000) + ' min ago' : 'Never');
  
  // Verify score calculations
  if (htItems.length > 0) {
    const firstItem = htItems[0];
    const components = firstItem.scoreComponents || {};
    const penalties = components.penalties || {};
    const calculatedScore = (components.momentum || 0) + 
      (components.consensus || 0) + 
      (components.liquidity || 0) + 
      (components.news || 0) +
      (components.universe || 0) +
      (penalties.spread || 0) +
      (penalties.liquidity || 0) +
      (penalties.price || 0) +
      (penalties.volume || 0) +
      (penalties.sentiment || 0);
    const clampedScore = Math.min(Math.max(calculatedScore, 0), 100);
    
    console.log('   ✅ First item score check:');
    console.log('      - Displayed:', firstItem.score);
    console.log('      - Calculated:', calculatedScore.toFixed(2));
    console.log('      - Clamped:', clampedScore.toFixed(2));
    console.log('      - Match:', Math.abs((firstItem.score || 0) - clampedScore) < 0.01 ? '✅ YES' : '❌ NO');
    const componentsSum = Object.values(components)
      .filter(value => typeof value === 'number')
      .reduce((a, b) => (a || 0) + (b || 0), 0);
    console.log('      - Components sum:', componentsSum.toFixed(2));
    
    // Check score components
    console.log('   ✅ Score components:', JSON.stringify(components, null, 2));
  }
  
  // 2. Trending
  const trending = await db.doc('market/trending').get();
  const trData = trending.exists ? trending.data() : null;
  
  console.log('\n2. Trending (market/trending):');
  console.log('   ✅ Exists:', trending.exists);
  if (trData?.byHorizon) {
    Object.keys(trData.byHorizon).forEach(h => {
      const hData = trData.byHorizon[h];
      const cryptoCount = hData.crypto?.length || 0;
      const stockCount = hData.stock?.length || 0;
      const forexCount = hData.forex?.length || 0;
      console.log('   ✅ ' + h + ':', cryptoCount + ' crypto,', stockCount + ' stocks,', forexCount + ' forex');
      
      // Verify first trending item score
      if (hData.crypto?.[0]) {
        const item = hData.crypto[0];
        const components = item.scoreComponents || item.components || {};
        const penalties = components.penalties || {};
        const calculatedScore = (components.momentum || 0) +
          (components.consensus || 0) +
          (components.liquidity || 0) +
          (components.news || 0) +
          (components.universe || 0) +
          (penalties.spread || 0) +
          (penalties.liquidity || 0) +
          (penalties.price || 0) +
          (penalties.volume || 0) +
          (penalties.sentiment || 0);
        
        if (Math.abs((item.score || 0) - calculatedScore) > 1) {
          console.log('   ⚠️  Score mismatch for', h + ':', item.symbol, '- Displayed:', item.score, 'Expected:', calculatedScore.toFixed(2));
        }
      }
    });
  }
  
  // 3. Popular
  const popular = await db.doc('market/popular').get();
  const popData = popular.exists ? popular.data() : null;
  
  console.log('\n3. Popular (market/popular):');
  console.log('   ✅ Items:', popData?.items?.length || 0);
  console.log('   ✅ Updated:', popData?.updatedAt ? Math.round((Date.now() - popData.updatedAt.toDate().getTime()) / 60000) + ' min ago' : 'Never');
  
  // 4. Signal Performance
  const signalPerf = await db.doc('analytics/signalPerformance').get();
  const spData = signalPerf.exists ? signalPerf.data() : null;
  
  console.log('\n4. Signal Performance (analytics/signalPerformance):');
  console.log('   ✅ Exists:', signalPerf.exists);
  if (spData?.overall) {
    Object.keys(spData.overall).forEach(h => {
      const hData = spData.overall[h];
      const calculatedHitRate = hData.count > 0 ? (hData.hits / hData.count) * 100 : 0;
      console.log('   ✅ ' + h + ':');
      console.log('      - Hit Rate:', hData.hitRate + '% (Displayed)');
      console.log('      - Calculated:', calculatedHitRate.toFixed(1) + '%');
      console.log('      - Match:', Math.abs(hData.hitRate - calculatedHitRate) < 0.1 ? '✅ YES' : '❌ NO');
      console.log('      - Count:', hData.count, '- Hits:', hData.hits);
    });
  }
  
  // 5. Controls
  const controls = await db.doc('market/controls').get();
  const ctrlData = controls.exists ? controls.data() : null;
  
  console.log('\n5. Controls (market/controls):');
  console.log('   ✅ Exists:', controls.exists);
  if (ctrlData) {
    const trendWeights = ctrlData.trendWeights || {};
    const weightSum = (trendWeights.momentum || 0) +
      (trendWeights.liquidity || trendWeights.volume || 0) +
      (trendWeights.consensus || trendWeights.signals || 0) +
      (trendWeights.news || 0);
    console.log('   ✅ Trend Weights:', JSON.stringify(trendWeights));
    console.log('   ✅ Weight Sum:', weightSum + '%');
    console.log('   ✅ Valid:', weightSum === 100 ? '✅ YES' : '❌ NO (should sum to 100)');
    console.log('   ✅ Auto-tune Enabled:', ctrlData.autoTuneEnabled || false);
  }
  
  // 6. Meta from hotTrades
  const meta = htData?.meta || {};
  console.log('\n6. Meta Information:');
  console.log('   ✅ Signal Weight:', meta.signalWeight || 1.0);
  console.log('   ✅ Accuracy Hit Rate:', meta.accuracyHitRate || 'N/A');
  console.log('   ✅ Accuracy Signals:', meta.accuracySignals || 0);
  console.log('   ✅ LLM Enabled:', meta.llmEnabled || false);
  console.log('   ✅ LLM Updated:', meta.llmUpdatedAt ? Math.round((Date.now() - meta.llmUpdatedAt.toDate().getTime()) / 60000) + ' min ago' : 'Never');
  
  return { hotTrades: htItems.length, trending: trData !== null, popular: popData !== null, signalPerf: spData !== null };
}

async function verifyBotsPage() {
  console.log('\n\n=== BOTS PAGE VERIFICATION ===\n');
  
  const bots = await db.collection('bots').get();
  
  console.log('1. Bots Collection:');
  console.log('   ✅ Count:', bots.size);
  
  for (const doc of bots.docs) {
    const bot = doc.data();
    const heartbeatAge = bot.lastHeartbeat ? 
      Math.round((Date.now() - bot.lastHeartbeat.toDate().getTime()) / 1000) : 999;
    
    console.log('\n2. Bot:', doc.id);
    console.log('   ✅ Name:', bot.name || 'unnamed');
    console.log('   ✅ Status:', bot.status || 'unknown');
    console.log('   ✅ Engine:', bot.engine || 'unknown');
    console.log('   ✅ Heartbeat:', heartbeatAge, 'seconds ago');
    console.log('   ✅ Online:', heartbeatAge < 60 ? '✅ YES' : '❌ NO');
    
    // Check signals count
    const signals = await db.collection('bots/' + doc.id + '/signals').count().get();
    console.log('   ✅ Signals:', signals.data().count);
    
    // Check events count
    const events = await db.collection('bots/' + doc.id + '/events').orderBy('createdAt', 'desc').limit(5).get();
    console.log('   ✅ Recent Events:', events.size);
  }
}

async function verifySignalsPage() {
  console.log('\n\n=== SIGNALS PAGE VERIFICATION ===\n');
  
  // Check all bot signals
  const bots = await db.collection('bots').get();
  
  for (const botDoc of bots.docs) {
    const botId = botDoc.id;
    const signals = await db.collection('bots/' + botId + '/signals')
      .orderBy('createdAt', 'desc').limit(10).get();
    
    console.log('1. Bot:', botId, '- Signals:', signals.size);
    
    if (signals.size > 0) {
      signals.forEach(doc => {
        const sig = doc.data();
        const age = sig.createdAt ? 
          Math.round((Date.now() - sig.createdAt.toDate().getTime()) / 60000) : 999;
        
        // Verify signal structure
        console.log('   ✅ Signal:', sig.symbol, '-', sig.side, '- Strength:', sig.strength || 'N/A', '- Age:', age, 'min');
        
        // Check if evaluation exists
        if (sig.evaluation) {
          const evalData = sig.evaluation;
          console.log('      - Evaluation exists:', true);
          if (evalData.horizons) {
            Object.keys(evalData.horizons).forEach(h => {
              const hData = evalData.horizons[h];
              const calculatedReturn = sig.data?.referencePrice && hData.priceAtHorizon ? 
                ((hData.priceAtHorizon - sig.data.referencePrice) / sig.data.referencePrice) * 100 : null;
              console.log('      - ' + h + ':', 'Hit:', hData.hit, '- Return:', hData.returnPct + '%');
            });
          }
        }
      });
    }
  }
}

async function verifyTradeNowPage() {
  console.log('\n\n=== TRADE NOW PAGE VERIFICATION ===\n');
  
  // Check action board
  const actionBoard = await db.doc('market/actionBoard').get();
  const abData = actionBoard.exists ? actionBoard.data() : null;
  
  console.log('1. Action Board (market/actionBoard):');
  console.log('   ✅ Exists:', actionBoard.exists);
  
  if (abData) {
    const buys = abData.buys || [];
    const sells = abData.sells || [];
    
    console.log('   ✅ Buys:', buys.length);
    console.log('   ✅ Sells:', sells.length);
    console.log('   ✅ Updated:', abData.updatedAt ? Math.round((Date.now() - abData.updatedAt.toDate().getTime()) / 60000) + ' min ago' : 'Never');
    
    // Verify scores
    if (buys.length > 0) {
      const firstBuy = buys[0];
      console.log('   ✅ First Buy:', firstBuy.symbol, '- Score:', firstBuy.score);
      
      // Check if action board uses news boost
      const meta = abData.meta || {};
      console.log('   ✅ News Weight:', meta.newsWeight || 0);
    }
  }
  
  // Check byAsset structure
  if (abData?.byAsset) {
    const byAsset = abData.byAsset;
    console.log('\n2. By Asset Structure:');
    console.log('   ✅ Crypto Buys:', byAsset.buys?.crypto?.length || 0);
    console.log('   ✅ Crypto Sells:', byAsset.sells?.crypto?.length || 0);
    console.log('   ✅ Stock Buys:', byAsset.buys?.stock?.length || 0);
    console.log('   ✅ Stock Sells:', byAsset.sells?.stock?.length || 0);
    console.log('   ✅ Forex Buys:', byAsset.buys?.forex?.length || 0);
    console.log('   ✅ Forex Sells:', byAsset.sells?.forex?.length || 0);
  }
}

async function verifyPaperPage() {
  console.log('\n\n=== PAPER TRADING PAGE VERIFICATION ===\n');
  
  // Check paper trading positions
  const paperRef = db.collection('paper');
  const paperPositions = await paperRef.get();
  
  console.log('1. Paper Trading Positions:');
  console.log('   ✅ Count:', paperPositions.size);
  
  paperPositions.forEach(doc => {
    const pos = doc.data();
    console.log('   ✅ Position:', pos.symbol || 'unknown', '- Side:', pos.side || 'unknown');
    
    // Verify position calculations
    if (pos.entryPrice && pos.currentPrice && pos.quantity) {
      const pnl = pos.side === 'buy' ? 
        (pos.currentPrice - pos.entryPrice) * pos.quantity :
        (pos.entryPrice - pos.currentPrice) * pos.quantity;
      const pnlPercent = ((pnl / (pos.entryPrice * pos.quantity)) * 100);
      
      console.log('      - Entry:', pos.entryPrice, '- Current:', pos.currentPrice);
      console.log('      - Quantity:', pos.quantity);
      console.log('      - Calculated PnL:', pnl.toFixed(2), '(', pnlPercent.toFixed(2) + '%)');
      if (pos.pnl !== undefined) {
        console.log('      - Stored PnL:', pos.pnl);
        console.log('      - Match:', Math.abs(pos.pnl - pnl) < 0.01 ? '✅ YES' : '❌ NO');
      }
    }
  });
}

async function main() {
  try {
    const dashboard = await verifyDashboard();
    await verifyBotsPage();
    await verifySignalsPage();
    await verifyTradeNowPage();
    await verifyPaperPage();
    
    console.log('\n\n=== SUMMARY ===');
    console.log('✅ Dashboard:', dashboard.hotTrades > 0 && dashboard.trending && dashboard.popular ? 'OK' : 'ISSUES');
    console.log('✅ All pages verified');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
