#!/usr/bin/env node
/**
 * Export data from Supabase for migration to Convex
 *
 * Usage: node export-supabase.mjs
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function exportData() {
  console.log('Starting Supabase data export...\n');

  // Export companies
  console.log('Exporting companies...');
  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('*');

  if (companiesError) {
    console.error('Error exporting companies:', companiesError);
    process.exit(1);
  }
  console.log(`  Found ${companies.length} companies`);

  // Export HaloPSA client mappings
  console.log('Exporting company-HaloPSA mappings...');
  const { data: halopsaMappings, error: halopsaError } = await supabase
    .from('company_halopsa_clients')
    .select('*');

  if (halopsaError) {
    console.error('Error exporting HaloPSA mappings:', halopsaError);
    process.exit(1);
  }
  console.log(`  Found ${halopsaMappings.length} HaloPSA mappings`);

  // Export user profiles
  console.log('Exporting user profiles...');
  const { data: userProfiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('*');

  if (profilesError) {
    console.error('Error exporting user profiles:', profilesError);
    process.exit(1);
  }
  console.log(`  Found ${userProfiles.length} user profiles`);

  // Export user-company associations
  console.log('Exporting user-company associations...');
  const { data: userCompanies, error: ucError } = await supabase
    .from('user_companies')
    .select('*');

  if (ucError) {
    console.error('Error exporting user companies:', ucError);
    process.exit(1);
  }
  console.log(`  Found ${userCompanies.length} user-company associations`);

  // Get user emails from auth.users (via service role)
  console.log('Fetching user emails...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('Error fetching auth users:', authError);
    process.exit(1);
  }
  console.log(`  Found ${authUsers.users.length} auth users`);

  // Create email lookup map
  const userEmailMap = {};
  for (const user of authUsers.users) {
    userEmailMap[user.id] = user.email;
  }

  // Export domain assignments if table exists
  console.log('Exporting domain assignments...');
  const { data: domainAssignments, error: domainError } = await supabase
    .from('domain_assignments')
    .select('*');

  if (domainError && !domainError.message.includes('does not exist')) {
    console.error('Error exporting domain assignments:', domainError);
  }
  console.log(`  Found ${domainAssignments?.length || 0} domain assignments`);

  // Combine all data
  const exportData = {
    exportedAt: new Date().toISOString(),
    companies,
    halopsaMappings,
    userProfiles,
    userCompanies,
    userEmailMap,
    domainAssignments: domainAssignments || [],
  };

  // Write to file
  const outputPath = join(__dirname, 'supabase-export.json');
  writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  console.log(`\nExport complete! Data written to: ${outputPath}`);

  // Print summary
  console.log('\nSummary:');
  console.log(`  - Companies: ${companies.length}`);
  console.log(`  - HaloPSA Mappings: ${halopsaMappings.length}`);
  console.log(`  - User Profiles: ${userProfiles.length}`);
  console.log(`  - User-Company Associations: ${userCompanies.length}`);
  console.log(`  - Auth Users: ${authUsers.users.length}`);
  console.log(`  - Domain Assignments: ${domainAssignments?.length || 0}`);
}

exportData().catch(console.error);
