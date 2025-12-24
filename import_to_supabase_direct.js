#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const SUPABASE_URL = 'https://supabase.allyoursoftware.co.uk';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NjU0OTc2MDAsImV4cCI6MTkyMzI2NDAwMH0.ZbEsoXyQbcwhuAKHlb9jr1qEOA3zEPLnMdhmpT1dMqk';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function importStackUserMappings() {
  console.log('🚀 Importing Stack User Mappings to Supabase');
  console.log('='.repeat(50));

  // Read the JSON file (easier to work with than SQL)
  const jsonFile = path.join(__dirname, '20i_stack_user_mappings.json');
  const mappingsData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

  console.log(`\n📊 Summary:`);
  console.log(`   Total Stack Users: ${mappingsData.summary.totalUsers}`);
  console.log(`   Total Domains: ${mappingsData.summary.totalDomains}`);
  console.log(`   Total Packages: ${mappingsData.summary.totalPackages}`);
  console.log(`   WordPress Packages: ${mappingsData.summary.totalWordPressPackages}`);

  // Prepare records for insertion
  const records = [];

  mappingsData.stackUsers.forEach(user => {
    user.packages.forEach(pkg => {
      records.push({
        stack_user_id: user.stackUserId,
        stack_user_ref: user.stackUserRef,
        domain_name: pkg.name, // Package name is the primary domain
        package_id: pkg.id,
        package_external_id: pkg.externalId,
        package_name: pkg.name,
        package_type: pkg.type,
        is_wordpress: pkg.isWordpress,
        is_enabled: pkg.enabled
      });
    });
  });

  console.log(`\n📝 Prepared ${records.length} records for insertion\n`);

  // Check if table exists by trying to query it
  console.log('🔍 Checking if table exists...');
  const { error: checkError } = await supabase
    .from('stack_user_domain_mappings')
    .select('id')
    .limit(1);

  if (checkError && checkError.message.includes('does not exist')) {
    console.log('❌ Table does not exist. Please create it first using the SQL file.');
    console.log('\nYou can create the table by:');
    console.log('1. Opening Supabase Studio: https://supabase.allyoursoftware.co.uk');
    console.log('2. Go to SQL Editor');
    console.log('3. Paste the contents of /tmp/20i_stack_user_mappings.sql');
    console.log('4. Run the first part (CREATE TABLE and CREATE INDEX statements)');
    console.log('5. Then run this script again');
    process.exit(1);
  }

  // Clear existing data (optional)
  console.log('🗑️  Clearing existing data...');
  const { error: deleteError } = await supabase
    .from('stack_user_domain_mappings')
    .delete()
    .neq('id', 0); // Delete all records

  if (deleteError) {
    console.log(`⚠️  Warning: Could not clear existing data: ${deleteError.message}`);
  }

  // Insert records in batches
  const batchSize = 10;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, Math.min(i + batchSize, records.length));

    process.stdout.write(`\r✏️  Inserting records ${i + 1}-${Math.min(i + batchSize, records.length)} of ${records.length}...`);

    const { data, error } = await supabase
      .from('stack_user_domain_mappings')
      .upsert(batch, {
        onConflict: 'stack_user_id,domain_name',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`\n❌ Error inserting batch: ${error.message}`);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n');
  console.log('='.repeat(50));
  console.log('✅ Import Complete!');
  console.log(`   Successful: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log('='.repeat(50));

  // Verify the data was imported
  console.log('\n🔍 Verifying import...');
  const { data, error, count } = await supabase
    .from('stack_user_domain_mappings')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ Error verifying import:', error.message);
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

  console.log('\n✨ Done! Your Stack User mappings are now in Supabase.');
  console.log('\n💡 Next steps:');
  console.log('   1. Use these mappings in your web app to pre-populate domain dropdowns');
  console.log('   2. Validate domain ownership by checking stack_user_id');
  console.log('   3. Query example: SELECT domain_name FROM stack_user_domain_mappings WHERE stack_user_id = \'907713\'');
}

importStackUserMappings().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
