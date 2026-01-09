const admin = require('firebase-admin');
const serviceAccount = require('./relayorb-firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkPrices() {
    console.log('--- Current Market Prices (Hot Trades) ---');
    try {
        const docSnap = await db.doc('market/hotTrades').get();
        if (!docSnap.exists) {
            console.log('market/hotTrades document not found.');
            return;
        }

        const data = docSnap.data();
        const items = data.items || [];
        const zkp = items.find(i => i.symbol === 'ZKP/USDT');

        if (zkp) {
            console.log(`Found ZKP/USDT:`);
            console.log(`  Current Price: ${zkp.price}`);
            console.log(`  24h Change: ${zkp.change24h}%`);
        } else {
            console.log('ZKP/USDT not found in hotTrades items.');
            // List a few symbols that ARE there
            console.log('Sample symbols available:', items.slice(0, 5).map(i => i.symbol).join(', '));
        }
    } catch (error) {
        console.error('Error fetching prices:', error);
    }
}

checkPrices();
