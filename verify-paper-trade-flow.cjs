const admin = require('firebase-admin');
const serviceAccount = require('./relayorb-firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function verifyPaperTradeFlow() {
    console.log('=== Verifying Paper Trade Flow ===\n');
    
    // Get a test user ID (you can change this)
    const userId = process.argv[2] || 'enEopK5vNkMWZrXJAllC9bX4cgu1';
    console.log(`Checking user: ${userId}\n`);

    try {
        // 1. Check if wallet exists
        console.log('1. Checking wallet...');
        const walletRef = db.doc(`users/${userId}/paper/wallet`);
        const walletSnap = await walletRef.get();
        
        if (!walletSnap.exists) {
            console.log('   ❌ No wallet found - trades won\'t work!');
            console.log('   💡 Wallet should be created automatically on first trade or login');
        } else {
            const wallet = walletSnap.data();
            console.log(`   ✅ Wallet exists`);
            console.log(`      Balance: $${wallet.balance?.toFixed(2) || 0}`);
            console.log(`      Currency: ${wallet.currency || 'USD'}`);
            console.log(`      Created: ${wallet.createdAt?.toDate?.() || 'N/A'}`);
        }

        // 2. Check positions
        console.log('\n2. Checking positions...');
        const positionsRef = db.collection(`users/${userId}/paper/wallet/positions`);
        const positionsSnap = await positionsRef.get();
        
        if (positionsSnap.empty) {
            console.log('   ℹ️  No open positions');
        } else {
            console.log(`   ✅ Found ${positionsSnap.size} position(s):`);
            positionsSnap.docs.forEach(doc => {
                const pos = doc.data();
                console.log(`      - ${pos.symbol} (${pos.assetClass})`);
                console.log(`        Quantity: ${pos.quantity}`);
                console.log(`        Avg Entry: $${pos.avgEntryPrice?.toFixed(4) || 'N/A'}`);
                console.log(`        Stop Loss: ${pos.stopLoss ? '$' + pos.stopLoss.toFixed(4) : 'None'}`);
                console.log(`        Take Profit: ${pos.takeProfit ? '$' + pos.takeProfit.toFixed(4) : 'None'}`);
                console.log(`        Created: ${pos.createdAt?.toDate?.() || 'N/A'}`);
            });
        }

        // 3. Check transactions
        console.log('\n3. Checking recent transactions...');
        const txRef = db.collection(`users/${userId}/paper/wallet/transactions`)
            .orderBy('timestamp', 'desc')
            .limit(10);
        const txSnap = await txRef.get();
        
        if (txSnap.empty) {
            console.log('   ℹ️  No transactions found');
        } else {
            console.log(`   ✅ Found ${txSnap.size} recent transaction(s):`);
            txSnap.docs.forEach(doc => {
                const tx = doc.data();
                console.log(`      - ${tx.side?.toUpperCase()} ${tx.symbol}`);
                console.log(`        Amount: ${tx.amount} @ $${tx.price?.toFixed(4) || 'N/A'}`);
                console.log(`        Cost: $${tx.cost?.toFixed(2) || 'N/A'}`);
                console.log(`        Type: ${tx.type || 'N/A'}`);
                console.log(`        Time: ${tx.timestamp?.toDate?.() || 'N/A'}`);
                if (tx.automated) console.log(`        🤖 Automated: ${tx.reason || 'N/A'}`);
            });
        }

        // 4. Check if market data exists for positions
        console.log('\n4. Checking market data availability...');
        const marketPricesRef = db.doc('market/prices');
        const marketPricesSnap = await marketPricesRef.get();
        
        if (!marketPricesSnap.exists) {
            console.log('   ⚠️  No market prices found - monitoring won\'t work!');
        } else {
            const marketData = marketPricesSnap.data();
            const items = marketData?.items || [];
            console.log(`   ✅ Market prices available (${items.length} symbols)`);
            
            if (!positionsSnap.empty) {
                console.log('\n   Checking if position symbols have market data:');
                positionsSnap.docs.forEach(doc => {
                    const pos = doc.data();
                    const symbol = pos.symbol?.toUpperCase();
                    const hasData = items.some(item => 
                        item.symbol?.toUpperCase() === symbol || 
                        item.symbol?.toUpperCase() === symbol.replace('/', '_')
                    );
                    if (hasData) {
                        const priceItem = items.find(item => 
                            item.symbol?.toUpperCase() === symbol || 
                            item.symbol?.toUpperCase() === symbol.replace('/', '_')
                        );
                        console.log(`      ✅ ${pos.symbol}: $${priceItem.price?.toFixed(4) || 'N/A'}`);
                    } else {
                        console.log(`      ❌ ${pos.symbol}: No market data - monitoring won't work!`);
                    }
                });
            }
        }

        // 5. Check backend monitoring
        console.log('\n5. Backend monitoring status...');
        console.log('   ℹ️  Backend monitoring runs in market-intel worker');
        console.log('   ℹ️  It scans all positions via collectionGroup("positions")');
        console.log('   ℹ️  Checks stop loss / take profit against market prices');
        console.log('   ℹ️  Executes automated sells when triggered');

        // 6. Check frontend monitoring
        console.log('\n6. Frontend monitoring status...');
        console.log('   ⚠️  usePaperAutomation hook exists but may not be called!');
        console.log('   💡 Should be called in a page component with userId and marketData');

        console.log('\n=== Summary ===');
        console.log('✅ Wallet: ' + (walletSnap.exists ? 'OK' : 'MISSING'));
        console.log('✅ Positions: ' + positionsSnap.size);
        console.log('✅ Transactions: ' + txSnap.size);
        console.log('✅ Market Data: ' + (marketPricesSnap.exists ? 'Available' : 'Missing'));
        
        if (!walletSnap.exists) {
            console.log('\n⚠️  ISSUE: Wallet missing - first trade should create it');
        }
        if (positionsSnap.size > 0 && !marketPricesSnap.exists) {
            console.log('\n⚠️  ISSUE: Positions exist but no market data - monitoring won\'t work');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

verifyPaperTradeFlow().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
