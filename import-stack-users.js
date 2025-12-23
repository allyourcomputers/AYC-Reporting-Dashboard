require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function importStackUserMappings() {
  console.log('🚀 Importing Stack User Mappings to Supabase\n');

  try {
    // Read the SQL file
    const sql = fs.readFileSync('/tmp/20i_stack_user_mappings.sql', 'utf8');

    // Split into individual statements and execute
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and empty statements
      if (!statement || statement.startsWith('--')) continue;

      // Show progress for key operations
      if (statement.includes('CREATE TABLE')) {
        console.log(`[${i + 1}/${statements.length}] Creating table...`);
      } else if (statement.includes('CREATE INDEX')) {
        console.log(`[${i + 1}/${statements.length}] Creating index...`);
      } else if (statement.includes('BEGIN')) {
        console.log(`[${i + 1}/${statements.length}] Starting transaction...`);
      } else if (statement.includes('INSERT INTO')) {
        const match = statement.match(/Stack User: (\d+)/);
        if (match) {
          process.stdout.write(`\r[${i + 1}/${statements.length}] Inserting Stack User ${match[1]}...`);
        }
      } else if (statement.includes('COMMIT')) {
        console.log(`\n[${i + 1}/${statements.length}] Committing transaction...`);
      } else {
        console.log(`[${i + 1}/${statements.length}] Executing...`);
      }

      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });

        if (error) {
          // Some errors are expected (like table already exists)
          if (error.message.includes('already exists')) {
            console.log(`  Note: ${error.message}`);
            successCount++;
          } else {
            console.log(`  ⚠️  Warning: ${error.message}`);
            errorCount++;
          }
        } else {
          successCount++;
        }
      } catch (err) {
        console.log(`  ⚠️  Warning: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n');
    console.log('='.repeat(50));
    console.log('✅ Import Complete!');
    console.log(`   Successful statements: ${successCount}`);
    console.log(`   Warnings/Errors: ${errorCount}`);
    console.log('='.repeat(50));

    // Verify the data was imported
    console.log('\n🔍 Verifying import...');
    const { data, error, count } = await supabase
      .from('stack_user_domain_mappings')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Error verifying import:', error.message);
      console.log('\nThe table might not exist yet.');
      console.log('Try running the CREATE TABLE statements manually in Supabase SQL Editor first.');
      return false;
    } else {
      console.log(`✅ Found ${count} records in stack_user_domain_mappings table`);
    }

    // Show sample data
    const { data: sampleData } = await supabase
      .from('stack_user_domain_mappings')
      .select('stack_user_id, domain_name, package_type, is_wordpress')
      .order('stack_user_id')
      .limit(5);

    if (sampleData && sampleData.length > 0) {
      console.log('\n📊 Sample data:');
      sampleData.forEach(row => {
        console.log(`   Stack User ${row.stack_user_id}: ${row.domain_name}`);
        console.log(`      Type: ${row.package_type}${row.is_wordpress ? ' (WordPress)' : ''}`);
      });
    }

    console.log('\n✨ Done! Stack User mappings are now in Supabase.');
    console.log('\n💡 Next steps:');
    console.log('   1. Use these mappings in your web app to pre-populate domain dropdowns');
    console.log('   2. Validate domain ownership by checking stack_user_id');
    console.log('   3. Query: SELECT domain_name FROM stack_user_domain_mappings WHERE stack_user_id = \'YOUR_ID\'');

    return true;
  } catch (error) {
    console.error('❌ Error importing data:', error.message);
    console.log('\nIf exec_sql RPC is not available, you can:');
    console.log('1. Open Supabase Studio: https://supabase.allyoursoftware.co.uk');
    console.log('2. Go to SQL Editor');
    console.log('3. Copy and paste from: /tmp/20i_stack_user_mappings.sql');
    console.log('4. Execute the SQL');
    return false;
  }
}

importStackUserMappings()
  .then((success) => {
    process.exit(success ? 0 : 1);
  });
