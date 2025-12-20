// Load .env file in development (not needed in Docker as env vars are injected)
require('dotenv').config();

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// HaloPSA Configuration
const HALO_API_URL = process.env.HALO_API_URL;
const HALO_AUTH_URL = HALO_API_URL ? HALO_API_URL.replace('/api', '/auth') : null;
const HALO_CLIENT_ID = process.env.HALO_CLIENT_ID;
const HALO_CLIENT_SECRET = process.env.HALO_CLIENT_SECRET;

// Supabase Configuration
// Use service_role key to bypass RLS for sync operations
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Debug: Log environment variable status (without revealing values)
console.log('Sync Service - Environment check:');
console.log('- HALO_API_URL:', HALO_API_URL || 'NOT SET');
console.log('- HALO_CLIENT_ID:', HALO_CLIENT_ID ? 'Set' : 'NOT SET');
console.log('- HALO_CLIENT_SECRET:', HALO_CLIENT_SECRET ? 'Set' : 'NOT SET');
console.log('- SUPABASE_URL:', SUPABASE_URL ? `Set (${SUPABASE_URL.substring(0, 20)}...)` : 'NOT SET');
console.log('- SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? `Set (${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...)` : 'NOT SET');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('In development: Add them to .env file');
  console.error('In Docker: Ensure .env file exists in the same directory as docker-compose.yml');
  console.error('');
  console.error('Find your service_role key in Supabase Dashboard > Settings > API');
  console.error('This key is required for the sync service to bypass RLS and write data');
  process.exit(1);
}

if (!HALO_API_URL || !HALO_CLIENT_ID || !HALO_CLIENT_SECRET) {
  console.error('ERROR: HaloPSA credentials must be set');
  console.error('Required: HALO_API_URL, HALO_CLIENT_ID, HALO_CLIENT_SECRET');
  process.exit(1);
}

// Create Supabase client with service_role key to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;

    return accessToken;
  } catch (error) {
    console.error('Error getting access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with HaloPSA');
  }
}

// Fetch all items with pagination
async function fetchAllItems(token, endpoint, params = {}) {
  let allItems = [];
  let pageNo = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await axios.get(`${HALO_API_URL}/${endpoint}`, {
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

    const items = response.data[endpoint.toLowerCase()] || response.data.tickets || response.data.clients || [];
    allItems = allItems.concat(items);

    const recordCount = response.data.record_count || 0;

    console.log(`  Page ${pageNo}: Fetched ${items.length} items, Total: ${allItems.length}/${recordCount}`);

    if (allItems.length >= recordCount || items.length === 0) {
      hasMore = false;
    } else {
      pageNo++;
    }
  }

  return allItems;
}

// Sync clients from HaloPSA to Supabase
async function syncClients() {
  console.log('\n=== Syncing Clients ===');

  try {
    const token = await getAccessToken();
    const clients = await fetchAllItems(token, 'Client');

    console.log(`Fetched ${clients.length} clients from HaloPSA`);

    // Transform and insert clients
    const transformedClients = clients.map(client => ({
      id: client.id,
      name: client.name,
      toplevel_id: client.toplevel_id,
      toplevel_name: client.toplevel_name,
      inactive: client.inactive || false,
      colour: client.colour,
      updated_at: new Date().toISOString()
    }));

    // Upsert clients (insert or update if exists)
    const { data, error } = await supabase
      .from('clients')
      .upsert(transformedClients, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting clients:', error);
      throw error;
    }

    console.log(`Successfully synced ${transformedClients.length} clients`);

    // Record sync metadata
    await supabase.from('sync_metadata').insert({
      sync_type: 'clients',
      last_sync: new Date().toISOString(),
      records_synced: transformedClients.length,
      status: 'success'
    });

    return transformedClients.length;
  } catch (error) {
    console.error('Error syncing clients:', error);

    // Record failed sync
    await supabase.from('sync_metadata').insert({
      sync_type: 'clients',
      last_sync: new Date().toISOString(),
      records_synced: 0,
      status: 'failed',
      error_message: error.message
    });

    throw error;
  }
}

// Sync tickets from HaloPSA to Supabase
async function syncTickets(monthsBack = 12) {
  console.log(`\n=== Syncing Tickets (last ${monthsBack} months) ===`);

  try {
    const token = await getAccessToken();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`Fetching tickets from ${startDateStr} to ${endDateStr}`);

    const tickets = await fetchAllItems(token, 'Tickets', {
      startdate: startDateStr,
      enddate: endDateStr
    });

    console.log(`Fetched ${tickets.length} tickets from HaloPSA`);

    // Transform and insert tickets
    const transformedTickets = tickets.map(ticket => ({
      id: ticket.id,
      client_id: ticket.client_id,
      client_name: ticket.client_name,
      site_id: ticket.site_id,
      site_name: ticket.site_name,
      user_id: ticket.user_id,
      user_name: ticket.user_name,
      summary: ticket.summary,
      details: ticket.details,
      status_id: ticket.status_id,
      status_name: ticket.statusname || ticket.status,
      priority_id: ticket.priority_id,
      tickettype_id: ticket.tickettype_id,
      team_id: ticket.team_id,
      team: ticket.team,
      agent_id: ticket.agent_id,
      date_occurred: ticket.dateoccurred,
      date_closed: ticket.dateclosed,
      response_date: ticket.responsedate,
      last_action_date: ticket.lastactiondate,
      is_closed: ticket.status_id === 9 ||
                 ticket.statusname?.toLowerCase().includes('closed') ||
                 ticket.status?.toLowerCase().includes('closed'),
      updated_at: new Date().toISOString()
    }));

    // Insert in batches of 1000
    const batchSize = 1000;
    for (let i = 0; i < transformedTickets.length; i += batchSize) {
      const batch = transformedTickets.slice(i, i + batchSize);

      console.log(`Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedTickets.length / batchSize)}`);

      const { error } = await supabase
        .from('tickets')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error('Error upserting tickets:', error);
        throw error;
      }
    }

    console.log(`Successfully synced ${transformedTickets.length} tickets`);

    // Update last_ticket_date for each client
    console.log('Updating client last ticket dates...');
    const { error: updateError } = await supabase.rpc('update_client_last_ticket_dates');

    if (updateError && !updateError.message.includes('does not exist')) {
      console.warn('Note: update_client_last_ticket_dates function not found. You may need to create it manually.');
    }

    // Record sync metadata
    await supabase.from('sync_metadata').insert({
      sync_type: 'tickets',
      last_sync: new Date().toISOString(),
      records_synced: transformedTickets.length,
      status: 'success'
    });

    return transformedTickets.length;
  } catch (error) {
    console.error('Error syncing tickets:', error);

    // Record failed sync
    await supabase.from('sync_metadata').insert({
      sync_type: 'tickets',
      last_sync: new Date().toISOString(),
      records_synced: 0,
      status: 'failed',
      error_message: error.message
    });

    throw error;
  }
}

// Sync feedback from HaloPSA to Supabase
async function syncFeedback() {
  console.log('\n=== Syncing Feedback ===');

  try {
    const token = await getAccessToken();

    // Fetch feedback data (try pagination, but may return all at once)
    let allFeedback = [];
    let pageNo = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await axios.get(`${HALO_API_URL}/Feedback`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          pageinate: true,
          page_size: 100,
          page_no: pageNo
        }
      });

      // Feedback may be returned directly as an array
      const items = Array.isArray(response.data) ? response.data : [];

      if (items.length === 0) {
        hasMore = false;
      } else {
        allFeedback = allFeedback.concat(items);
        console.log(`  Page ${pageNo}: Fetched ${items.length} items, Total: ${allFeedback.length}`);

        // If we got less than page_size, we've reached the end
        if (items.length < 100) {
          hasMore = false;
        } else {
          pageNo++;
        }
      }
    }

    console.log(`Fetched ${allFeedback.length} feedback entries from HaloPSA`);

    if (allFeedback.length === 0) {
      console.log('No feedback data to sync');
      return 0;
    }

    // Get all ticket IDs from our database to verify foreign key constraints
    const { data: existingTickets, error: ticketCheckError } = await supabase
      .from('tickets')
      .select('id');

    if (ticketCheckError) {
      console.error('Error checking existing tickets:', ticketCheckError);
      throw ticketCheckError;
    }

    const existingTicketIds = new Set(existingTickets.map(t => t.id));

    // Transform and filter feedback (only include feedback for tickets we have)
    const transformedFeedback = allFeedback
      .filter(feedback => {
        if (!feedback.ticket_id || !existingTicketIds.has(feedback.ticket_id)) {
          console.log(`  Skipping feedback ${feedback.id} - ticket ${feedback.ticket_id} not in database`);
          return false;
        }
        return true;
      })
      .map(feedback => ({
        id: feedback.id,
        ticket_id: feedback.ticket_id,
        score: feedback.score,
        score_band: feedback.score_band,
        date: feedback.date,
        comment: feedback.comment || null,
        ip_address: feedback.ip_address || null,
        updated_at: new Date().toISOString()
      }));

    console.log(`Filtered to ${transformedFeedback.length} feedback entries with matching tickets`);

    if (transformedFeedback.length === 0) {
      console.log('No feedback entries matched existing tickets');
      return 0;
    }

    // Upsert feedback
    const { error } = await supabase
      .from('feedback')
      .upsert(transformedFeedback, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting feedback:', error);
      throw error;
    }

    console.log(`Successfully synced ${transformedFeedback.length} feedback entries`);

    // Calculate satisfaction stats
    const totalWithScore = transformedFeedback.filter(f => f.score).length;
    const satisfied = transformedFeedback.filter(f => f.score === 1).length;
    const dissatisfied = transformedFeedback.filter(f => f.score === 2).length;

    console.log(`  Satisfaction: ${satisfied}/${totalWithScore} (${(satisfied/totalWithScore*100).toFixed(1)}%)`);
    console.log(`  Dissatisfied: ${dissatisfied}/${totalWithScore} (${(dissatisfied/totalWithScore*100).toFixed(1)}%)`);

    // Record sync metadata
    await supabase.from('sync_metadata').insert({
      sync_type: 'feedback',
      last_sync: new Date().toISOString(),
      records_synced: transformedFeedback.length,
      status: 'success'
    });

    return transformedFeedback.length;
  } catch (error) {
    console.error('Error syncing feedback:', error);

    // Record failed sync
    await supabase.from('sync_metadata').insert({
      sync_type: 'feedback',
      last_sync: new Date().toISOString(),
      records_synced: 0,
      status: 'failed',
      error_message: error.message
    });

    throw error;
  }
}

// Main sync function
async function performFullSync(monthsBack = 12) {
  console.log('=== Starting Full Sync ===');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    const clientCount = await syncClients();
    const ticketCount = await syncTickets(monthsBack);
    const feedbackCount = await syncFeedback();

    console.log('\n=== Sync Complete ===');
    console.log(`Clients synced: ${clientCount}`);
    console.log(`Tickets synced: ${ticketCount}`);
    console.log(`Feedback synced: ${feedbackCount}`);
    console.log(`Finished: ${new Date().toISOString()}`);

    return { clientCount, ticketCount, feedbackCount };
  } catch (error) {
    console.error('\n=== Sync Failed ===');
    console.error(error);
    throw error;
  }
}

// Export functions
module.exports = {
  syncClients,
  syncTickets,
  syncFeedback,
  performFullSync,
  supabase
};

// Run sync if called directly
if (require.main === module) {
  const monthsBack = process.argv[2] ? parseInt(process.argv[2]) : 12;

  performFullSync(monthsBack)
    .then(() => {
      console.log('\nSync completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nSync failed:', error);
      process.exit(1);
    });
}
