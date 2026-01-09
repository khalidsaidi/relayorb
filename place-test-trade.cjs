const admin = require('firebase-admin');
const serviceAccount = require('./relayorb-firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function placeTestTrade() {
    console.log('=== Placing Strategic Test Trade ===');
    const userId = 'enEopK5vNkMWZrXJAllC9bX4cgu1';

    try {
        // 1. Get current price
        const priceSnap = await db.doc('market/prices').get();
        const items = priceSnap.data().items || [];
        const zkp = items.find(i => i.symbol === 'ZKP/USDT');

        if (!zkp) {
            console.error('ZKP/USDT price not found.');
            return;
        }

        const currentPrice = zkp.price;
        const testTP = 0.1000; // Guaranteed to be "hit" if price is 0.18+
        console.log(`Current Price: $${currentPrice}`);
        console.log(`Setting TP to: $${testTP.toFixed(4)} (Guaranteed trigger)`);

        // 2. Clear old positions for clean test
        const posSnap = await db.collection(`users/${userId}/paper/wallet/positions`).get();
        for (const doc of posSnap.docs) {
            await doc.ref.delete();
        }
        console.log('Cleared existing positions.');

        // 3. Place new position
        const symbolId = 'ZKP_USDT'; // Sanitized
        const posRef = db.doc(`users/${userId}/paper/wallet/positions/${symbolId}`);

        const newPos = {
            symbol: 'ZKP/USDT',
            assetClass: 'crypto',
            quantity: 1000,
            avgEntryPrice: currentPrice,
            takeProfit: testTP,
            stopLoss: currentPrice - 0.01,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        await posRef.set(newPos);
        console.log(`Placed test position for ZKP/USDT at $${currentPrice}`);

        // 4. Record the Buy transaction
        const txRef = db.collection(`users/${userId}/paper/wallet/transactions`).doc();
        await txRef.set({
            userId,
            symbol: 'ZKP/USDT',
            assetClass: 'crypto',
            side: 'buy',
            amount: 1000,
            price: currentPrice,
            cost: 1000 * currentPrice,
            type: 'open',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Recorded BUY transaction.');
        console.log('\nSUCCESS: Trade is live. Now run the automation worker to see it close.');

    } catch (err) {
        console.error('Test trade failed:', err);
    }
}

placeTestTrade();
