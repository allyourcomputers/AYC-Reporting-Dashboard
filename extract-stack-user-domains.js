#!/usr/bin/env node
/**
 * Extract Complete Stack User to Domain Mappings from 20i
 *
 * This script fetches all Stack Users and their assigned domains/packages
 * from the 20i reseller API and saves them to Supabase.
 *
 * Usage: node extract-stack-user-domains.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const TWENTYI_API_KEY = process.env.TWENTYI_API_KEY;
const TWENTYI_BASE_URL = 'https://api.20i.com';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Stack Users data from web scraping (ID, name, domain count, package count)
const STACK_USERS = [
  { id: '2023322', name: 'Astrid Ingram-Brooke', email: 'astrid@inghambrooke.com', packages: 1, domains: 0 },
  { id: '2023296', name: 'Craig Niblock', email: 'craig@silverboltsystems.com', packages: 1, domains: 1 },
  { id: '911901', name: 'Debbie Tomlinson', email: 'debbie@aawadmin.co.uk', packages: 1, domains: 2 },
  { id: '2022864', name: 'Edward Burns', email: 'edward@advocate-art.com', packages: 0, domains: 50 },
  { id: '2023346', name: 'Farook Owadally', email: 'farook@oandk.co.uk', packages: 3, domains: 3 },
  { id: '3803106', name: 'Joanne Element', email: 'joanne.element@gmail.com', packages: 0, domains: 0 },
  { id: '1773562', name: 'Jonathon Northcott', email: 'jon@havocdesigns.co.uk', packages: 3, domains: 4 },
  { id: '2023316', name: 'Luke Erhlanderr', email: 'lukeerhlanderr@gmail.com', packages: 1, domains: 2 },
  { id: '2023290', name: 'Mark Butcher', email: 'mark.butcher@abacusproperty-solutions.co.uk', packages: 1, domains: 1 },
  { id: '4773007', name: 'Martin Dearlove', email: 'Martindearlove@yahoo.co.uk', packages: 1, domains: 0 },
  { id: '2023268', name: 'Martin Horswood', email: 'martin@allyourcomputers.co.uk', packages: 5, domains: 10 },
  { id: '4833503', name: 'Naomi Smith', email: 'nsmith@rosekirk.co.uk', packages: 0, domains: 0 },
  { id: '2023386', name: 'Nicola Jesty', email: 'nicolajesty@me.com', packages: 1, domains: 1 },
  { id: '2023284', name: 'Rachel Annette', email: 'rachel.j.annette@hotmail.co.uk', packages: 1, domains: 8 },
  { id: '920199', name: 'Ross MacLennan', email: 'ross@freelance.email', packages: 3, domains: 2 },
  { id: '4606664', name: 'Sarah Jones', email: 'sarah@money-pad.co.uk', packages: 0, domains: 1 },
  { id: '2857296', name: 'Shamal Samal', email: 'shamal.samal@googlemail.com', packages: 0, domains: 0 },
  { id: '2023274', name: 'Toby Smith', email: 'voysey3@hotmail.com', packages: 4, domains: 5 },
  { id: '912727', name: 'Trish Bayliss', email: 'trish.bayliss@btinternet.com', packages: 1, domains: 3 },
  { id: '1017975', name: 'Zee Ahmed', email: 'zee@ammcore.com', packages: 0, domains: 0 },
];

async function api20i(endpoint) {
  const response = await fetch(`${TWENTYI_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${TWENTYI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`20i API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getStackUserContracts(stackUserId) {
  try {
    // Try to get contracts for this stack user
    const contracts = await api20i(`/reseller/*/stackUser/${stackUserId}/contract`);
    return contracts;
  } catch (error) {
    console.log(`  Could not fetch contracts for ${stackUserId}: ${error.message}`);
    return null;
  }
}

async function getAllPackagesWithStackUsers() {
  console.log('Fetching all hosting packages...');
  const packages = await api20i('/package');

  const packageMap = {};
  for (const pkg of packages) {
    if (pkg.stackUsers && pkg.stackUsers.length > 0) {
      for (const stackUserRef of pkg.stackUsers) {
        // stackUserRef format: "stack-user:XXXXXX"
        const stackUserId = stackUserRef.replace('stack-user:', '');
        if (!packageMap[stackUserId]) {
          packageMap[stackUserId] = [];
        }
        packageMap[stackUserId].push({
          packageId: pkg.id,
          name: pkg.name,
          names: pkg.names,
          type: pkg.packageTypeName,
          platform: pkg.platform,
          isWordpress: pkg.isWordpress
        });
      }
    }
  }

  return packageMap;
}

async function getAllDomains() {
  console.log('Fetching all domains...');
  const domains = await api20i('/domain');
  return domains;
}

async function buildCompleteMappings() {
  console.log('='.repeat(60));
  console.log('Stack User to Domain Mapping Extraction');
  console.log('='.repeat(60));
  console.log('');

  // Get packages with their Stack User assignments
  const packagesByStackUser = await getAllPackagesWithStackUsers();
  console.log(`Found ${Object.keys(packagesByStackUser).length} Stack Users with packages`);

  // Get all domains
  const allDomains = await getAllDomains();
  console.log(`Found ${allDomains.length} total domains`);

  // Build mappings for each Stack User
  const mappings = [];

  for (const stackUser of STACK_USERS) {
    console.log(`\nProcessing: ${stackUser.name} (ID: ${stackUser.id})`);
    console.log(`  Expected: ${stackUser.packages} packages, ${stackUser.domains} domains`);

    const packages = packagesByStackUser[stackUser.id] || [];
    console.log(`  Found ${packages.length} packages from API`);

    // Get domains from packages
    const packageDomains = new Set();
    for (const pkg of packages) {
      if (pkg.names) {
        pkg.names.forEach(name => packageDomains.add(name));
      } else if (pkg.name) {
        packageDomains.add(pkg.name);
      }
    }

    // Add package-based mappings
    for (const pkg of packages) {
      const domainName = pkg.name || (pkg.names && pkg.names[0]);
      if (domainName) {
        mappings.push({
          stack_user_id: stackUser.id,
          stack_user_ref: `stack-user:${stackUser.id}`,
          stack_user_name: stackUser.name,
          stack_user_email: stackUser.email,
          domain_name: domainName,
          package_id: pkg.packageId,
          package_name: pkg.name,
          package_type: pkg.type,
          is_wordpress: pkg.isWordpress || false,
          is_domain_only: false,
          is_enabled: true
        });
      }
    }

    // For Stack Users with domain-only assignments (no package),
    // we need to get this from the web interface
    // For now, flag them for manual review
    if (stackUser.domains > packages.length) {
      console.log(`  ** Has ${stackUser.domains - packages.length} domain-only assignments (needs web scraping)`);
    }
  }

  return mappings;
}

async function saveToSupabase(mappings) {
  console.log('\n' + '='.repeat(60));
  console.log('Saving to Supabase...');
  console.log('='.repeat(60));

  // First, clear existing data
  console.log('Clearing existing stack_user_domain_mappings...');
  const { error: deleteError } = await supabase
    .from('stack_user_domain_mappings')
    .delete()
    .neq('stack_user_id', '0'); // Delete all

  if (deleteError) {
    console.log(`Warning: Could not clear existing data: ${deleteError.message}`);
  }

  // Insert new mappings
  console.log(`Inserting ${mappings.length} mappings...`);

  const { data, error } = await supabase
    .from('stack_user_domain_mappings')
    .insert(mappings);

  if (error) {
    console.error('Error inserting mappings:', error.message);
    return false;
  }

  console.log('Successfully saved mappings to Supabase!');
  return true;
}

async function main() {
  try {
    const mappings = await buildCompleteMappings();

    console.log('\n' + '='.repeat(60));
    console.log(`Total mappings found: ${mappings.length}`);
    console.log('='.repeat(60));

    // Show summary by Stack User
    const summary = {};
    for (const m of mappings) {
      if (!summary[m.stack_user_name]) {
        summary[m.stack_user_name] = { domains: [], packages: 0 };
      }
      summary[m.stack_user_name].domains.push(m.domain_name);
      summary[m.stack_user_name].packages++;
    }

    console.log('\nSummary by Stack User:');
    for (const [name, data] of Object.entries(summary)) {
      console.log(`  ${name}: ${data.packages} mappings`);
      data.domains.forEach(d => console.log(`    - ${d}`));
    }

    // Save to file for reference
    const fs = require('fs');
    fs.writeFileSync('/tmp/stack_user_mappings_api.json', JSON.stringify(mappings, null, 2));
    console.log('\nSaved mappings to /tmp/stack_user_mappings_api.json');

    // Save to Supabase
    await saveToSupabase(mappings);

    console.log('\n' + '='.repeat(60));
    console.log('IMPORTANT: Domain-only assignments need manual extraction');
    console.log('Stack Users with domain-only assignments:');
    for (const su of STACK_USERS) {
      const foundPackages = (summary[su.name]?.packages || 0);
      if (su.domains > foundPackages) {
        console.log(`  - ${su.name}: Has ${su.domains} domains but only ${foundPackages} packages`);
      }
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
