require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  console.log('🚀 Starting multi-tenant migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '001-multi-tenant.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📝 SQL length:', sql.length, 'characters\n');

    // Split SQL into individual statements (rough split on semicolons)
    // This is a simple approach - for complex SQL you might need better parsing
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log('📋 Found', statements.length, 'SQL statements to execute\n');

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments
      if (statement.startsWith('--')) continue;

      console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);

      // Log first 100 chars of statement
      const preview = statement.substring(0, 100).replace(/\s+/g, ' ');
      console.log(`   ${preview}${statement.length > 100 ? '...' : ''}`);

      const { data, error } = await supabase.rpc('exec_sql', {
        query: statement + ';'
      }).catch(async () => {
        // If exec_sql function doesn't exist, try direct query
        return await supabase.from('_sql').select('*').limit(0);
      });

      if (error) {
        // Try using the Supabase REST API directly
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: statement + ';' })
        }).catch(() => null);

        if (!response || !response.ok) {
          console.log('   ⚠️  Note: Cannot execute via API (this is normal for DDL statements)');
          console.log('   Statement will need to be run in Supabase SQL Editor');
        }
      } else {
        console.log('   ✅ Success');
      }
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('⚠️  IMPORTANT: Supabase client cannot execute DDL statements via API');
    console.log('='.repeat(70));
    console.log('\nYou need to run the migration manually in Supabase Dashboard:\n');
    console.log('1. Go to: https://supabase.com/dashboard/project/_/sql');
    console.log('2. Click "New Query"');
    console.log('3. Copy the contents of: migrations/001-multi-tenant.sql');
    console.log('4. Paste and click "Run"\n');
    console.log('After running the migration, create your first super admin:');
    console.log('');
    console.log('INSERT INTO user_profiles (user_id, full_name, role)');
    console.log("VALUES ('<user-id-from-supabase-auth>', 'Your Name', 'super_admin');");
    console.log('\n' + '='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
