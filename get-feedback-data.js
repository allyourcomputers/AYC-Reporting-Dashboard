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

async function getFeedback() {
  try {
    const token = await getAccessToken();

    const response = await axios.get(`${HALO_API_URL}/Feedback`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        pageinate: true,
        page_size: 100,
        page_no: 1
      }
    });

    console.log('\n=== Feedback Data ===');
    console.log('Total feedback entries:', Array.isArray(response.data) ? response.data.length : 'Unknown');

    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log('\nSample feedback fields:', Object.keys(response.data[0]));
      console.log('\nFirst 3 feedback entries:');
      response.data.slice(0, 3).forEach((item, index) => {
        console.log(`\n--- Feedback ${index + 1} ---`);
        console.log(JSON.stringify(item, null, 2));
      });

      // Analyze ratings
      const ratings = response.data.map(f => f.rating || f.score || f.satisfaction).filter(Boolean);
      console.log('\n=== Feedback Analysis ===');
      console.log('Total feedback with ratings:', ratings.length);
      if (ratings.length > 0) {
        console.log('Sample ratings:', ratings.slice(0, 10));
      }
    } else {
      console.log('Feedback data:', response.data);
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

getFeedback();
