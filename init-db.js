require('dotenv').config();
const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function initDatabase() {
  console.log('Initializing Supabase database schema...\n');

  const queries = [
    {
      name: 'Create clients table',
      sql: `
        CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          toplevel_id INTEGER,
          toplevel_name TEXT,
          inactive BOOLEAN DEFAULT false,
          colour TEXT,
          last_ticket_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
    },
    {
      name: 'Create tickets table',
      sql: `
        CREATE TABLE IF NOT EXISTS tickets (
          id INTEGER PRIMARY KEY,
          client_id INTEGER NOT NULL,
          client_name TEXT,
          site_id INTEGER,
          site_name TEXT,
          user_id INTEGER,
          user_name TEXT,
          summary TEXT,
          details TEXT,
          status_id INTEGER,
          status_name TEXT,
          priority_id INTEGER,
          tickettype_id INTEGER,
          team_id INTEGER,
          team TEXT,
          agent_id INTEGER,
          date_occurred TIMESTAMP NOT NULL,
          date_closed TIMESTAMP,
          response_date TIMESTAMP,
          last_action_date TIMESTAMP,
          is_closed BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
    },
    {
      name: 'Create sync_metadata table',
      sql: `
        CREATE TABLE IF NOT EXISTS sync_metadata (
          id SERIAL PRIMARY KEY,
          sync_type TEXT NOT NULL,
          last_sync TIMESTAMP NOT NULL,
          records_synced INTEGER DEFAULT 0,
          status TEXT DEFAULT 'success',
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
    },
    {
      name: 'Create index on tickets.client_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON tickets(client_id)'
    },
    {
      name: 'Create index on tickets.date_occurred',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_date_occurred ON tickets(date_occurred)'
    },
    {
      name: 'Create index on tickets.is_closed',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_is_closed ON tickets(is_closed)'
    },
    {
      name: 'Create composite index',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_client_date ON tickets(client_id, date_occurred)'
    }
  ];

  let successCount = 0;
  let failCount = 0;

  for (const query of queries) {
    try {
      console.log(`Executing: ${query.name}...`);

      const response = await axios.post(
        `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        { query: query.sql },
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`  ✓ ${query.name} - Success\n`);
      successCount++;
    } catch (error) {
      if (error.response) {
        console.log(`  ⚠ ${query.name} - ${error.response.status}: ${error.response.data?.message || error.message}\n`);
      } else {
        console.log(`  ⚠ ${query.name} - ${error.message}\n`);
      }
      failCount++;
    }
  }

  console.log('\n=== Database Initialization Summary ===');
  console.log(`Successful: ${successCount}`);
  console.log(`Failed/Skipped: ${failCount}`);

  if (failCount === queries.length) {
    console.log('\n⚠ All queries failed. Your Supabase instance may not support direct SQL execution.');
    console.log('Please run the setup-database.sql file manually in your Supabase SQL editor.\n');
    return false;
  } else if (successCount > 0) {
    console.log('\n✓ Database schema initialized successfully!');
    console.log('Next step: Run `node sync-service.js` to populate data\n');
    return true;
  }
}

initDatabase()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
