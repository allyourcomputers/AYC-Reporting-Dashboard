require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function addFeedbackTable() {
  console.log('Adding feedback table to Supabase...\n');

  // Read the SQL file
  const sql = fs.readFileSync('./add-feedback-table.sql', 'utf8');

  // Split by semicolon to execute each statement separately
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  const queries = [
    {
      name: 'Create feedback table',
      sql: statements[0]
    },
    {
      name: 'Create index on feedback.ticket_id',
      sql: statements[1]
    },
    {
      name: 'Create index on feedback.date',
      sql: statements[2]
    },
    {
      name: 'Create index on feedback.score',
      sql: statements[3]
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

  console.log('\n=== Feedback Table Creation Summary ===');
  console.log(`Successful: ${successCount}`);
  console.log(`Failed/Skipped: ${failCount}`);

  if (failCount === queries.length) {
    console.log('\n⚠ All queries failed. Your Supabase instance may not support direct SQL execution.');
    console.log('Please run the add-feedback-table.sql file manually in your Supabase SQL editor.\n');
    return false;
  } else if (successCount > 0) {
    console.log('\n✓ Feedback table created successfully!');
    return true;
  }
}

addFeedbackTable()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
