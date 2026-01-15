import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

console.log('========== PRICE DATA DIAGNOSTIC ==========\n');

// 1. Check market/prices structure
console.log('1. MARKET/PRICES DOCUMENT');
const pricesDoc = await db.doc('market/prices').get();
if (pricesDoc.exists) {
  const data = pricesDoc.data();
  console.log('   Document keys:', Object.keys(data).join(', '));

  const age = Date.now() - (data.updatedAt?.toMillis?.() || 0);
  console.log('   Updated:', Math.round(age/60000), 'min ago');

  // Check items (the actual price data)
  if (data.items) {
    console.log('   Items count:', data.items.length);
    if (data.items.length > 0) {
      // Group by asset class
      const byAsset = {};
      data.items.forEach(item => {
        const ac = item.assetClass || 'unknown';
        if (!byAsset[ac]) byAsset[ac] = [];
        byAsset[ac].push(item);
      });
      console.log('   By asset class:', Object.entries(byAsset).map(([k,v]) => k + ':' + v.length).join(', '));

      // Sample items
      console.log('\n   Sample items:');
      data.items.slice(0, 3).forEach(item => {
        console.log('     -', item.assetClass, item.symbol, 'price=' + item.price, 'change1m=' + item.change1m);
      });
    }
  }

  // Check meta
  if (data.meta) {
    console.log('\n   Meta:', JSON.stringify(data.meta, null, 2).split('\n').map(l => '   ' + l).join('\n'));
  }
} else {
  console.log('   ERROR: market/prices document NOT FOUND!');
}

// 2. Check price_streamer health document
console.log('\n2. PRICE STREAMER HEALTH');
const psDoc = await db.doc('pipeline/price_streamer').get();
if (psDoc.exists) {
  const data = psDoc.data();
  console.log('   Status:', data.status);
  console.log('   Price count:', data.priceCount);
  console.log('   Is price stale:', data.isPriceStale);
  console.log('   Watchlist:', JSON.stringify(data.watchlist));
  console.log('   Market status:', JSON.stringify(data.marketStatus));
  console.log('   Rate limit:', JSON.stringify(data.rateLimit));
  console.log('   Poll health:', JSON.stringify(data.pollHealth, null, 2).split('\n').map(l => '   ' + l).join('\n'));
} else {
  console.log('   ERROR: pipeline/price_streamer NOT FOUND!');
}

// 3. Check market/universe (source of watchlist)
console.log('\n3. MARKET/UNIVERSE (source of watchlist symbols)');
const universeDoc = await db.doc('market/universe').get();
if (universeDoc.exists) {
  const data = universeDoc.data();
  console.log('   Document keys:', Object.keys(data).join(', '));

  // Check crypto
  if (data.crypto) {
    console.log('   Crypto symbols:', data.crypto.symbols?.length || 0);
    if (data.crypto.symbols?.length > 0) {
      console.log('     Sample:', data.crypto.symbols.slice(0, 5).join(', '));
    }
    console.log('   Crypto mode:', data.crypto.mode || 'not set');
  } else {
    console.log('   Crypto: NOT DEFINED');
  }

  // Check stocks
  if (data.stocks) {
    console.log('   Stocks symbols:', data.stocks.symbols?.length || 0);
    if (data.stocks.symbols?.length > 0) {
      console.log('     Sample:', data.stocks.symbols.slice(0, 5).join(', '));
    }
    console.log('   Stocks mode:', data.stocks.mode || 'not set');
  } else {
    console.log('   Stocks: NOT DEFINED');
  }

  // Check forex
  if (data.forex) {
    console.log('   Forex pairs:', data.forex.pairs?.length || 0);
    if (data.forex.pairs?.length > 0) {
      console.log('     Sample:', data.forex.pairs.slice(0, 5).join(', '));
    }
    console.log('   Forex mode:', data.forex.mode || 'not set');
  } else {
    console.log('   Forex: NOT DEFINED');
  }

  // Check old format
  if (Array.isArray(data.crypto)) {
    console.log('   [OLD FORMAT] crypto array:', data.crypto.length);
  }
  if (Array.isArray(data.stocks)) {
    console.log('   [OLD FORMAT] stocks array:', data.stocks.length);
  }
  if (Array.isArray(data.forex)) {
    console.log('   [OLD FORMAT] forex array:', data.forex.length);
  }
} else {
  console.log('   ERROR: market/universe NOT FOUND!');
}

// 4. Check market/hotTrades (another source)
console.log('\n4. MARKET/HOT_TRADES (another watchlist source)');
const htDoc = await db.doc('market/hotTrades').get();
if (htDoc.exists) {
  const data = htDoc.data();
  console.log('   Document keys:', Object.keys(data).join(', '));

  // Check items array
  if (data.items) {
    console.log('   Items:', data.items.length);
    // Group by asset class
    const byAsset = {};
    data.items.forEach(item => {
      const ac = item.assetClass || 'unknown';
      if (!byAsset[ac]) byAsset[ac] = [];
      byAsset[ac].push(item);
    });
    console.log('   By asset:', Object.entries(byAsset).map(([k,v]) => k + ':' + v.length).join(', '));
  }

  // Check buy/sell arrays (if UI expects this format)
  if (data.buy) console.log('   Buy:', data.buy.length);
  if (data.sell) console.log('   Sell:', data.sell.length);
} else {
  console.log('   market/hotTrades NOT FOUND');
}

// 5. Check positions (another source)
console.log('\n5. OPEN POSITIONS (another watchlist source)');
const posSnap = await db.collectionGroup('positions').get();
console.log('   Total positions:', posSnap.size);
if (posSnap.size > 0) {
  const byAsset = {};
  posSnap.docs.forEach(doc => {
    const data = doc.data();
    const ac = data.assetClass || 'unknown';
    if (!byAsset[ac]) byAsset[ac] = 0;
    byAsset[ac]++;
  });
  console.log('   By asset:', Object.entries(byAsset).map(([k,v]) => k + ':' + v).join(', '));
}

// 6. Check market/streamSymbols
console.log('\n6. STREAM SYMBOLS (dynamic watchlist)');
const streamDoc = await db.doc('market/streamSymbols').get();
if (streamDoc.exists) {
  const data = streamDoc.data();
  console.log('   Top level keys:', Object.keys(data).join(', '));
  if (data.symbols) {
    console.log('   Crypto:', data.symbols.crypto?.length || 0);
    console.log('   Stock:', data.symbols.stock?.length || 0);
    console.log('   Forex:', data.symbols.forex?.length || 0);
  }
  if (data.sources) {
    console.log('   Sources:', Object.keys(data.sources).length);
  }
} else {
  console.log('   market/streamSymbols NOT FOUND');
}

// 7. Check market/movers (used for stock discovery)
console.log('\n7. MARKET/MOVERS (stock discovery source)');
const moversDoc = await db.doc('market/movers').get();
if (moversDoc.exists) {
  const data = moversDoc.data();
  console.log('   Document keys:', Object.keys(data).join(', '));

  if (data.markets?.us) {
    const us = data.markets.us;
    console.log('   US Gainers:', us.gainers?.length || 0);
    console.log('   US Actives:', us.actives?.length || 0);
    console.log('   US Losers:', us.losers?.length || 0);
  } else {
    console.log('   No markets.us data');
  }

  // Old format check
  if (data.gainers) console.log('   [OLD] gainers:', data.gainers.length);
  if (data.losers) console.log('   [OLD] losers:', data.losers.length);
  if (data.mostActive) console.log('   [OLD] mostActive:', data.mostActive.length);
} else {
  console.log('   market/movers NOT FOUND');
}

// 8. Summary assessment
console.log('\n========== ASSESSMENT ==========');

const issues = [];
const pricesData = pricesDoc.exists ? pricesDoc.data() : null;
const universeData = universeDoc.exists ? universeDoc.data() : null;
const psData = psDoc.exists ? psDoc.data() : null;

// Check if prices are actually being written
if (!pricesData?.items || pricesData.items.length === 0) {
  issues.push('CRITICAL: market/prices has no items');
}

// Check if watchlist is being populated
if (psData) {
  const totalWatchlist = (psData.watchlist?.crypto || 0) + (psData.watchlist?.stock || 0) + (psData.watchlist?.forex || 0);
  if (totalWatchlist === 0) {
    issues.push('CRITICAL: Watchlist is empty - no symbols to fetch prices for');
  }
}

// Check universe configuration
if (universeData) {
  const hasCrypto = universeData.crypto?.symbols?.length > 0;
  const hasStocks = universeData.stocks?.symbols?.length > 0;
  const hasForex = universeData.forex?.pairs?.length > 0;

  if (!hasCrypto && !hasStocks && !hasForex) {
    issues.push('WARNING: market/universe has no symbols configured');
  }
}

// Check for schema mismatches
if (pricesData?.symbols && !pricesData?.items) {
  issues.push('INFO: market/prices has old "symbols" format, expected "items" array');
}

if (issues.length === 0) {
  console.log('No critical issues detected');
} else {
  issues.forEach((issue, i) => console.log((i+1) + '. ' + issue));
}

console.log('\n========== END DIAGNOSTIC ==========');
process.exit(0);
