const admin = require('firebase-admin');
const serviceAccount = require('./relayorb-firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkBots() {
    const userId = 'enEopK5vNkMWZrXJAllC9bX4cgu1';
    console.log(`--- Active Bots for User ${userId} ---`);
    try {
        const snapshot = await db.collection('users').doc(userId).collection('bots').where('status', '==', 'online').get();
        if (snapshot.empty) {
            console.log('No online bots found.');
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Bot Name: ${data.name}`);
            console.log(`  Strategy: ${data.strategy}`);
            console.log(`  Assets: ${data.assets?.join(', ') || 'Global'}`);
            console.log(`  ID: ${doc.id}`);
            console.log('-----------------------------------');
        });
    } catch (error) {
        console.error('Error fetching bots:', error);
    }
}

checkBots();
