const admin = require('firebase-admin');
const serviceAccount = require('./relayorb-firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkCommands() {
    const botId = 'freqtrade-1';
    console.log(`--- Commands for Bot ${botId} ---`);
    try {
        const snapshot = await db.collection('bots').doc(botId).collection('commands').orderBy('createdAt', 'desc').limit(5).get();
        if (snapshot.empty) {
            console.log('No commands found.');
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Command: ${data.type}`);
            console.log(`  Status: ${data.status}`);
            console.log(`  Error: ${JSON.stringify(data.error) || 'None'}`);
            console.log(`  CreatedAt: ${data.createdAt?.toDate?.() || data.createdAt}`);
            console.log('-----------------------------------');
        });
    } catch (error) {
        console.error('Error fetching commands:', error);
    }
}

checkCommands();
