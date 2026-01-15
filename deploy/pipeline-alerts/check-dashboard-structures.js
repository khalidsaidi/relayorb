import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

console.log('=== EXACT DOCUMENT STRUCTURES ===\n');

// 1. Hot Trades - check actual structure vs what UI expects
console.log('1. market/hotTrades');
const htDoc = await db.doc('market/hotTrades').get();
if (htDoc.exists) {
  const data = htDoc.data();
  console.log('   Top-level keys:', Object.keys(data).join(', '));
  console.log('   Has items[]:', Array.isArray(data.items), '- count:', data.items?.length || 0);
  console.log('   Has buy[]:', Array.isArray(data.buy), '- count:', data.buy?.length || 0);
  console.log('   Has sell[]:', Array.isArray(data.sell), '- count:', data.sell?.length || 0);
}

// 2. Universe - check actual structure
console.log('\n2. market/universe');
const univDoc = await db.doc('market/universe').get();
if (univDoc.exists) {
  const data = univDoc.data();
  console.log('   Top-level keys:', Object.keys(data).join(', '));

  // Crypto
  console.log('\n   crypto:');
  console.log('     Type:', typeof data.crypto);
  if (Array.isArray(data.crypto)) {
    console.log('     Is array, length:', data.crypto.length);
  } else if (typeof data.crypto === 'object') {
    console.log('     Keys:', Object.keys(data.crypto || {}).join(', '));
    console.log('     symbols:', data.crypto?.symbols?.length || 'undefined');
    console.log('     mode:', data.crypto?.mode);
  }

  // Stocks
  console.log('\n   stocks:');
  console.log('     Type:', typeof data.stocks);
  if (Array.isArray(data.stocks)) {
    console.log('     Is array, length:', data.stocks.length);
  } else if (typeof data.stocks === 'object') {
    console.log('     Keys:', Object.keys(data.stocks || {}).join(', '));
    console.log('     symbols:', data.stocks?.symbols?.length || 'undefined');
    console.log('     mode:', data.stocks?.mode);
    if (data.stocks?.symbols?.length > 0) {
      console.log('     Sample:', data.stocks.symbols.slice(0, 5).join(', '));
    }
  }

  // Forex
  console.log('\n   forex:');
  console.log('     Type:', typeof data.forex);
  if (Array.isArray(data.forex)) {
    console.log('     Is array, length:', data.forex.length);
  } else if (typeof data.forex === 'object') {
    console.log('     Keys:', Object.keys(data.forex || {}).join(', '));
    console.log('     pairs:', data.forex?.pairs?.length || 'undefined');
    console.log('     mode:', data.forex?.mode);
  }
}

// 3. Movers - check actual structure
console.log('\n3. market/movers');
const moversDoc = await db.doc('market/movers').get();
if (moversDoc.exists) {
  const data = moversDoc.data();
  console.log('   Top-level keys:', Object.keys(data).join(', '));

  // Old format
  console.log('   gainers[] (old):', data.gainers?.length || 0);
  console.log('   losers[] (old):', data.losers?.length || 0);
  console.log('   mostActive[] (old):', data.mostActive?.length || 0);

  // New format
  if (data.markets) {
    console.log('   markets keys:', Object.keys(data.markets).join(', '));
    if (data.markets.us) {
      console.log('   markets.us.gainers:', data.markets.us.gainers?.length || 0);
      console.log('   markets.us.losers:', data.markets.us.losers?.length || 0);
      console.log('   markets.us.actives:', data.markets.us.actives?.length || 0);
    }
  }
}

// 4. News - check actual structure
console.log('\n4. market/news');
const newsDoc = await db.doc('market/news').get();
if (newsDoc.exists) {
  const data = newsDoc.data();
  console.log('   Top-level keys:', Object.keys(data).join(', '));
  console.log('   items[]:', data.items?.length || 0);
  console.log('   articles[]:', data.articles?.length || 0);

  // Check meta
  if (data.meta) {
    console.log('   meta:', JSON.stringify(data.meta));
  }
}

// 5. Action Board
console.log('\n5. market/actionBoard');
const abDoc = await db.doc('market/actionBoard').get();
if (abDoc.exists) {
  const data = abDoc.data();
  console.log('   Top-level keys:', Object.keys(data).join(', '));
  console.log('   buys:', data.buys?.length || 0);
  console.log('   sells:', data.sells?.length || 0);
}

console.log('\n=== END ===');
process.exit(0);
