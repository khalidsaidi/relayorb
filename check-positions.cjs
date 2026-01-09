const admin = require('firebase-admin');
const serviceAccount = require('./relayorb-firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkPositions() {
    console.log('--- Current Open Paper Positions ---');
    try {
        const snapshot = await db.collectionGroup('positions').get();
        if (snapshot.empty) {
            console.log('No open positions found.');
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const pathParts = doc.ref.path.split('/');
            const userId = pathParts[1];
            console.log(`User: ${userId}`);
            console.log(`  Symbol: ${data.symbol}`);
            console.log(`  Quantity: ${data.quantity}`);
            console.log(`  Avg Entry: ${data.avgEntryPrice}`);
            console.log(`  Stop Loss: ${data.stopLoss || 'N/A'}`);
            console.log(`  Take Profit: ${data.takeProfit || 'N/A'}`);
            console.log('-----------------------------------');
        });
    } catch (error) {
        console.error('Error fetching positions:', error);
    }
}

checkPositions();
