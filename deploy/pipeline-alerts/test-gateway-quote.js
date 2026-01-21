// Test if gateway returns changePercent for stocks

const GATEWAY_URL = process.env.MARKET_DATA_GATEWAY_URL || 'https://relayorb-market-data-gateway-1071103469376.us-west1.run.app';

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
