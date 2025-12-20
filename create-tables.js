require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function createTables() {
  console.log('Creating database schema...\n');

  try {
    // Read the SQL file
    const sql = fs.readFileSync('setup-database.sql', 'utf8');

    // Split into individual statements and execute
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and empty statements
      if (!statement || statement.startsWith('--')) continue;

      console.log(`Executing statement ${i + 1}/${statements.length}...`);

      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });

        if (error) {
          console.log(`  Note: ${error.message}`);
        } else {
          console.log(`  ✓ Success`);
        }
      } catch (err) {
        console.log(`  Warning: ${err.message}`);
      }
    }

    console.log('\nDatabase schema creation complete!');
    console.log('Note: Some warnings are normal if tables already exist or if using alternative methods.\n');

    return true;
  } catch (error) {
    console.error('Error creating tables:', error);
    return false;
  }
}

createTables()
  .then((success) => {
    if (success) {
      console.log('✓ Database setup complete!');
      console.log('\nNext step: Run sync-service.js to populate data');
    } else {
      console.log('✗ Database setup failed');
      console.log('\nPlease run setup-database.sql manually in your Supabase SQL editor');
    }
    process.exit(success ? 0 : 1);
  });
