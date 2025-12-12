require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', SUPABASE_URL);
console.log('Key:', SUPABASE_KEY ? 'Set (hidden)' : 'NOT SET');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
  try {
    // Try to list tables
    console.log('\nAttempting to query database...');

    const { data, error } = await supabase
      .from('clients')
      .select('count')
      .limit(1);

    if (error) {
      console.log('Error (expected if table doesn\'t exist):', error.message);
      return false;
    }

    console.log('Success! Connected to Supabase.');
    console.log('Clients table exists with data:', data);
    return true;
  } catch (error) {
    console.error('Connection test failed:', error.message);
    return false;
  }
}

testConnection()
  .then((success) => {
    if (success) {
      console.log('\n✓ Supabase connection successful!');
    } else {
      console.log('\n✗ Supabase connection failed or tables don\'t exist yet.');
      console.log('You may need to run setup-database.sql first.');
    }
    process.exit(success ? 0 : 1);
  });
