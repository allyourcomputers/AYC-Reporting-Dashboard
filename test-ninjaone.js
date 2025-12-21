require('dotenv').config();
const ninjaOneClient = require('./ninjaone-client');

async function test() {
    console.log('Testing NinjaOne connection...');
    console.log('Environment variables:');
    console.log('- NINJA_CLIENT_ID:', process.env.NINJA_CLIENT_ID ? 'Set' : 'NOT SET');
    console.log('- NINJA_CLIENT_SECRET:', process.env.NINJA_CLIENT_SECRET ? 'Set' : 'NOT SET');
    console.log('- NINJA_BASE_URL:', process.env.NINJA_BASE_URL || 'NOT SET');
    console.log('');

    try {
        console.log('Attempting to fetch servers...');

        // Get raw device data to see all available fields
        const ninjaOneAPI = require('./ninjaone-client');
        const axios = require('axios');

        // Get token
        const tokenResponse = await axios.post(
            `${process.env.NINJA_BASE_URL}/ws/oauth/token`,
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: process.env.NINJA_CLIENT_ID,
                client_secret: process.env.NINJA_CLIENT_SECRET,
                scope: 'monitoring management control'
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const token = tokenResponse.data.access_token;

        // Get first device to see all fields
        const devicesResponse = await axios.get(`${process.env.NINJA_BASE_URL}/v2/devices`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { pageSize: 1 }
        });

        console.log('Sample device fields:', Object.keys(devicesResponse.data[0]));
        console.log('Full device data:', JSON.stringify(devicesResponse.data[0], null, 2));

    } catch (error) {
        console.error('ERROR:', error.message);
        console.error('Full error:', error);
    }
}

test();
