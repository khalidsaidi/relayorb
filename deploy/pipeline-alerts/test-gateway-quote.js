// Test if gateway returns changePercent for stocks

const GATEWAY_URL = process.env.MARKET_DATA_GATEWAY_URL;
if (!GATEWAY_URL) {
  console.error('MARKET_DATA_GATEWAY_URL environment variable is required');
  process.exit(1);
}

async function testQuote() {
  const symbols = ['NVDA', 'AAPL', 'TSLA'];

  for (const symbol of symbols) {
    try {
      const url = new URL('/v1/fmp/quote', GATEWAY_URL);
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('assetClass', 'stock');

      const res = await fetch(url.toString());
      const data = await res.json();

      console.log(`\n${symbol}:`);
      console.log('  price:', data.price);
      console.log('  changePercent:', data.changePercent);
      console.log('  All keys:', Object.keys(data).join(', '));
    } catch (err) {
      console.log(`\n${symbol}: ERROR -`, err.message);
    }
  }
}

testQuote().then(() => process.exit(0));
