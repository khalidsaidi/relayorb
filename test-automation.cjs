const admin = require('firebase-admin');
const serviceAccount = require('./relayorb-firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function testAutomation() {
    console.log('\n=======================================');
    console.log('   RELAYORB PAPER AUTOMATION CHECKER');
    console.log('=======================================\n');

    try {
        // 1. Fetch current live prices
        const priceSnap = await db.doc('market/prices').get();
        if (!priceSnap.exists) {
            console.log('Error: market/prices document not found.');
            return;
        }
        const data = priceSnap.data();
        const items = data.items || [];
        const prices = {};
        items.forEach(item => {
            if (item.symbol && typeof item.price === 'number') {
                prices[item.symbol.toUpperCase()] = item.price;
            }
        });
        console.log(`[SYSTEM] Loaded ${Object.keys(prices).length} live prices from Firestore.`);

        // 2. Fetch all open positions
        const positionSnap = await db.collectionGroup('positions').get();
        if (positionSnap.empty) {
            console.log('[SYSTEM] No open positions found. Place a trade in the UI first!');
            return;
        }

        console.log(`[SYSTEM] Found ${positionSnap.size} open positions. Analyzing triggers...\n`);

        positionSnap.forEach(doc => {
            const pos = doc.data();
            const symbol = pos.symbol.toUpperCase();
            const currentPrice = prices[symbol];
            const pathParts = doc.ref.path.split('/');
            const userId = pathParts[1];

            console.log(`[ASSET] ${symbol}`);
            console.log(`  User ID: ${userId}`);

            if (currentPrice === undefined) {
                console.log(`  ?? Status: ?? NO LIVE PRICE. Monitoring is paused for this asset.`);
                console.log(`     Tip: Ensure prices for ${symbol} are visible with green dots in the Dashboard.`);
            } else {
                const diff = currentPrice - (pos.avgEntryPrice || 0);
                const pnl = (diff / (pos.avgEntryPrice || 1)) * 100;

                console.log(`  >> Market Price: $${currentPrice.toFixed(4)}`);
                console.log(`  >> Your Entry:   $${(pos.avgEntryPrice || 0).toFixed(4)} (${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%)`);

                let triggered = false;
                if (pos.stopLoss && currentPrice <= pos.stopLoss) {
                    console.log(`  ?? TRIGGERED: STOP LOSS hit ($${pos.stopLoss})`);
                    triggered = true;
                } else if (pos.takeProfit && currentPrice >= pos.takeProfit) {
                    console.log(`  ?? TRIGGERED: TAKE PROFIT hit ($${pos.takeProfit})`);
                    triggered = true;
                } else {
                    console.log(`  ?? Status: ?? MONITORING ACTIVE`);
                    if (pos.stopLoss) console.log(`     - Stop Loss:   $${pos.stopLoss} (Distance: $${(currentPrice - pos.stopLoss).toFixed(4)})`);
                    if (pos.takeProfit) console.log(`     - Take Profit: $${pos.takeProfit} (Distance: $${(pos.takeProfit - currentPrice).toFixed(4)})`);
                    if (!pos.stopLoss && !pos.takeProfit) console.log(`     - No SL/TP set. This trade will remain open indefinitely.`);
                }

                if (triggered) {
                    console.log(`  ?? ACTION: This trade will be AUTO-CLOSED on the next server cycle.`);
                }
            }
            console.log('---------------------------------------\n');
        });

    } catch (err) {
        console.error('Automation test failed:', err);
    }
}

testAutomation();
