const admin = require('firebase-admin');
const serviceAccount = require('./relayorb-firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function listAllBots() {
    const userId = 'enEopK5vNkMWZrXJAllC9bX4cgu1';
    console.log(`--- All Bots for User ${userId} ---`);
    try {
        const snapshot = await db.collection('users').doc(userId).collection('bots').get();
        if (snapshot.empty) {
            console.log('No bots found at all.');
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Bot: ${data.name || 'Unnamed'}`);
            console.log(`  ID: ${doc.id}`);
            console.log(`  Status: ${data.status}`);
            console.log(`  Strategy: ${data.strategy}`);
            console.log(`  Assets: ${data.assets?.join(', ') || 'Global'}`);
            console.log('-----------------------------------');
        });
    } catch (error) {
        console.error('Error fetching bots:', error);
    }
}

listAllBots();
