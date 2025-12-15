require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3100;

app.use(express.json());
app.use(express.static('public'));

// HaloPSA API Configuration
const HALO_API_URL = process.env.HALO_API_URL;
const HALO_AUTH_URL = HALO_API_URL.replace('/api', '/auth');
const HALO_CLIENT_ID = process.env.HALO_CLIENT_ID;
const HALO_CLIENT_SECRET = process.env.HALO_CLIENT_SECRET;

let accessToken = null;
let tokenExpiry = null;

// Get OAuth token from HaloPSA
async function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
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

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Refresh 1 min before expiry

    return accessToken;
  } catch (error) {
    console.error('Error getting access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with HaloPSA');
  }
}

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const token = await getAccessToken();

    const response = await axios.get(`${HALO_API_URL}/Client`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        pageinate: true,
        page_size: 1000,
        page_no: 1,
        order: 'name',
        orderdesc: false
      }
    });

    const clients = response.data.clients || response.data || [];
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Helper function to fetch all tickets with pagination
async function fetchAllTickets(token, params) {
  let allTickets = [];
  let pageNo = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await axios.get(`${HALO_API_URL}/Tickets`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        ...params,
        pageinate: true,
        page_size: 100,
        page_no: pageNo
      }
    });

    const tickets = response.data.tickets || [];
    allTickets = allTickets.concat(tickets);

    const recordCount = response.data.record_count || 0;
    const pageSize = response.data.page_size || 100;

    console.log(`Page ${pageNo}: Fetched ${tickets.length} tickets, Total so far: ${allTickets.length}/${recordCount}`);

    // Check if we've fetched all tickets
    if (allTickets.length >= recordCount || tickets.length === 0) {
      hasMore = false;
    } else {
      pageNo++;
    }
  }

  return allTickets;
}

// Get ticket statistics for a client
app.get('/api/tickets/stats', async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;

    if (!clientId || !startDate || !endDate) {
      return res.status(400).json({ error: 'clientId, startDate, and endDate are required' });
    }

    const token = await getAccessToken();

    // Fetch all tickets for the client within the date range
    const tickets = await fetchAllTickets(token, {
      client_id: clientId,
      startdate: startDate,
      enddate: endDate
    });

    console.log(`Total tickets fetched for client ${clientId}: ${tickets.length}`);

    // Calculate statistics
    const totalTickets = tickets.length;
    const closedTickets = tickets.filter(ticket =>
      ticket.status_id === 9 || // Closed
      ticket.statusname?.toLowerCase().includes('closed') ||
      ticket.status?.toLowerCase().includes('closed')
    ).length;

    res.json({
      totalTickets,
      closedTickets,
      openTickets: totalTickets - closedTickets,
      tickets: tickets.map(t => ({
        id: t.id,
        summary: t.summary,
        status: t.statusname || t.status,
        dateOccurred: t.dateoccurred,
        dateClosed: t.dateclosed
      }))
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch ticket statistics' });
  }
});

// Get monthly statistics for multiple months
app.post('/api/tickets/monthly-stats', async (req, res) => {
  try {
    const { clientId, months } = req.body;

    if (!clientId || !months || !Array.isArray(months)) {
      return res.status(400).json({ error: 'clientId and months array are required' });
    }

    const token = await getAccessToken();
    const results = [];

    for (const month of months) {
      const { startDate, endDate } = month;

      console.log(`Fetching tickets for ${month.label}...`);

      // Fetch all tickets for this month
      const tickets = await fetchAllTickets(token, {
        client_id: clientId,
        startdate: startDate,
        enddate: endDate
      });

      console.log(`Total tickets for ${month.label}: ${tickets.length}`);

      const totalTickets = tickets.length;
      const closedTickets = tickets.filter(ticket =>
        ticket.status_id === 9 ||
        ticket.statusname?.toLowerCase().includes('closed') ||
        ticket.status?.toLowerCase().includes('closed')
      ).length;

      results.push({
        month: month.label,
        startDate,
        endDate,
        totalTickets,
        closedTickets,
        openTickets: totalTickets - closedTickets
      });
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching monthly stats:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch monthly statistics' });
  }
});

app.listen(PORT, () => {
  console.log(`HaloPSA Reporting Server running on http://localhost:${PORT}`);
});
