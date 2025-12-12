require('dotenv').config();
const axios = require('axios');

const HALO_API_URL = process.env.HALO_API_URL;
const HALO_AUTH_URL = HALO_API_URL.replace('/api', '/auth');
const HALO_CLIENT_ID = process.env.HALO_CLIENT_ID;
const HALO_CLIENT_SECRET = process.env.HALO_CLIENT_SECRET;

async function getAccessToken() {
  const response = await axios.post(`${HALO_AUTH_URL}/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: HALO_CLIENT_ID,
      client_secret: HALO_CLIENT_SECRET,
      scope: 'all'
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  return response.data.access_token;
}

async function testFeedbackEndpoints() {
  try {
    const token = await getAccessToken();

    const possibleEndpoints = [
      'Feedback',
      'TicketFeedback',
      'Survey',
      'CustomerSatisfaction',
      'Rating',
      'CustomerFeedback'
    ];

    console.log('\n=== Testing Feedback Endpoints ===\n');

    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Testing: ${HALO_API_URL}/${endpoint}`);
        const response = await axios.get(`${HALO_API_URL}/${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: {
            pageinate: true,
            page_size: 5,
            page_no: 1
          }
        });

        console.log(`✓ ${endpoint} - SUCCESS!`);
        console.log(`  Response keys:`, Object.keys(response.data));
        if (response.data.feedback || response.data[endpoint.toLowerCase()]) {
          const data = response.data.feedback || response.data[endpoint.toLowerCase()];
          if (data && data.length > 0) {
            console.log(`  Sample fields:`, Object.keys(data[0]));
            console.log(`  Sample data:`, JSON.stringify(data[0], null, 2));
          }
        }
        console.log('');
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`✗ ${endpoint} - Not found (404)`);
        } else {
          console.log(`✗ ${endpoint} - Error: ${error.response?.status} ${error.message}`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testFeedbackEndpoints();
