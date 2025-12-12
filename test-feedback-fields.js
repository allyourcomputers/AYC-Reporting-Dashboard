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

async function checkFeedbackFields() {
  try {
    const token = await getAccessToken();

    // Fetch a few recent tickets to see all available fields
    const response = await axios.get(`${HALO_API_URL}/Tickets`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        pageinate: true,
        page_size: 5,
        page_no: 1,
        // Get tickets with feedback if possible
        order: 'id',
        orderdesc: true
      }
    });

    const tickets = response.data.tickets || [];

    console.log('\n=== Sample Ticket Fields ===');
    if (tickets.length > 0) {
      console.log('Available fields in ticket:', Object.keys(tickets[0]).sort());
      console.log('\n=== Full first ticket data ===');
      console.log(JSON.stringify(tickets[0], null, 2));

      // Look for feedback-related fields
      const feedbackFields = Object.keys(tickets[0]).filter(key =>
        key.toLowerCase().includes('feedback') ||
        key.toLowerCase().includes('rating') ||
        key.toLowerCase().includes('satisfaction') ||
        key.toLowerCase().includes('survey') ||
        key.toLowerCase().includes('happy')
      );

      console.log('\n=== Feedback-related fields found ===');
      if (feedbackFields.length > 0) {
        feedbackFields.forEach(field => {
          console.log(`${field}: ${tickets[0][field]}`);
        });
      } else {
        console.log('No feedback-related fields found in ticket object');
      }
    } else {
      console.log('No tickets found');
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkFeedbackFields();
