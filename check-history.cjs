const admin = require('firebase-admin');
const serviceAccount = require('./relayorb-firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkHistory() {
    console.log('\n=======================================');
    console.log('   RELAYORB TRANSACTION HISTORY check');
    console.log('=======================================\n');

    try {
        const snapshot = await db.collectionGroup('transactions').limit(20).get();
        if (snapshot.empty) {
            console.log('No transactions found in history.');
            return;
        }

        snapshot.forEach(doc => {
            const tx = doc.data();
            const date = tx.timestamp ? tx.timestamp.toDate().toLocaleString() : 'N/A';
            const price = typeof tx.price === 'number' ? tx.price.toFixed(4) : 'N/A';
            const qty = typeof tx.amount === 'number' ? tx.amount.toFixed(2) : 'N/A';

            console.log(`[${date}] ${tx.side?.toUpperCase() || 'UNKNOWN'} ${tx.symbol}`);
            console.log(`  Price: $${price} | Qty: ${qty}`);
            if (tx.reason) console.log(`  Closed via: ${tx.reason}`);
            console.log('---------------------------------------');
        });
    } catch (err) {
        console.error('History check failed:', err);
    }
}

checkHistory();
