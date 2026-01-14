import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'relayorb' });
const db = admin.firestore();

// Top liquid stocks to add
const topStocks = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'AMD', 'NFLX', 'DIS',
  'BABA', 'INTC', 'COIN', 'PLTR', 'SOFI', 'NIO', 'RIVN', 'LCID', 'F', 'GM',
  'BA', 'UBER', 'LYFT', 'ABNB', 'HOOD', 'SQ', 'PYPL', 'V', 'MA', 'JPM',
  'BAC', 'WFC', 'GS', 'MS', 'C', 'USB', 'PNC', 'TFC', 'SCHW', 'BLK',
  'BBAI', 'LEXXW'  // Keep existing
];

async function addStocks() {
  try {
    await db.doc('market/universe').update({
      'stocks.symbols': topStocks
    });

    console.log(`✅ Added ${topStocks.length} stocks to universe`);
    console.log('Symbols:', topStocks.join(', '));
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

addStocks();
