#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createTable() {
  console.log('📋 Creating stack_user_domain_mappings table...\n');

  // Check if table already exists
  const { data: existingTables, error: checkError } = await supabase
    .from('stack_user_domain_mappings')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('✅ Table already exists!');
    return;
  }

  // Create the table using raw SQL via the REST API
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS stack_user_domain_mappings (
        id SERIAL PRIMARY KEY,
        stack_user_id VARCHAR(50) NOT NULL,
        stack_user_ref VARCHAR(100) NOT NULL,
        domain_name VARCHAR(255) NOT NULL,
        package_id INTEGER,
        package_external_id VARCHAR(50),
        package_name VARCHAR(255),
        package_type VARCHAR(100),
        is_wordpress BOOLEAN DEFAULT FALSE,
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_domain UNIQUE (stack_user_id, domain_name)
    );

    CREATE INDEX IF NOT EXISTS idx_stack_user_id ON stack_user_domain_mappings(stack_user_id);
    CREATE INDEX IF NOT EXISTS idx_domain_name ON stack_user_domain_mappings(domain_name);
    CREATE INDEX IF NOT EXISTS idx_package_id ON stack_user_domain_mappings(package_id);
  `;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: createTableSQL })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    console.log('✅ Table created successfully!');
  } catch (error) {
    console.error('\n❌ Could not create table via API:', error.message);
    console.log('\n📝 Please create the table manually:');
    console.log('1. Open Supabase Studio: https://supabase.allyoursoftware.co.uk');
    console.log('2. Go to SQL Editor');
    console.log('3. Copy and paste the SQL from: /tmp/20i_stack_user_mappings.sql');
    console.log('4. Execute the CREATE TABLE and CREATE INDEX statements\n');
  }
}

createTable().catch(console.error);
