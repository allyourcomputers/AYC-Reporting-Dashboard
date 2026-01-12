#!/usr/bin/env node
/**
 * Import exported Supabase data into Convex
 *
 * Usage: node import-to-convex.mjs
 *
 * Requires:
 *   - supabase-export.json file (created by export-supabase.mjs)
 *   - CONVEX_DEPLOY_KEY environment variable
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONVEX_URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;

if (!CONVEX_URL) {
  console.error('Error: CONVEX_URL or VITE_CONVEX_URL environment variable is required');
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// Load exported data
const exportPath = join(__dirname, 'supabase-export.json');
if (!existsSync(exportPath)) {
  console.error(`Error: Export file not found: ${exportPath}`);
  console.error('Run export-supabase.mjs first to create the export file.');
  process.exit(1);
}

const exportData = JSON.parse(readFileSync(exportPath, 'utf-8'));

console.log('Supabase to Convex Data Migration');
console.log('==================================\n');
console.log(`Export created at: ${exportData.exportedAt}\n`);

async function importData() {
  // Maps to track Supabase ID -> Convex ID relationships
  const companyIdMap = new Map(); // supabaseUUID -> convexId
  const userIdMap = new Map(); // supabaseUUID -> convexId

  // Step 1: Build HaloPSA mappings per company
  console.log('Step 1: Processing HaloPSA mappings...');
  const companyHaloPsaMap = new Map(); // companySupabaseId -> haloPsaClientId

  for (const mapping of exportData.halopsaMappings) {
    // In Supabase, there could be multiple HaloPSA clients per company
    // For Convex, we'll take the first one (or could concatenate)
    if (!companyHaloPsaMap.has(mapping.company_id)) {
      companyHaloPsaMap.set(mapping.company_id, String(mapping.halopsa_client_id));
    }
  }
  console.log(`  Processed ${companyHaloPsaMap.size} company -> HaloPSA mappings\n`);

  // Step 2: Import companies
  console.log('Step 2: Importing companies...');
  let companiesCreated = 0;
  let companiesUpdated = 0;

  for (const company of exportData.companies) {
    const haloPsaClientId = companyHaloPsaMap.get(company.id);

    const result = await client.mutation(api.migration.importCompany, {
      supabaseId: company.id,
      name: company.name,
      haloPsaClientId: haloPsaClientId,
      logo: company.logo_url || undefined,
      isActive: true,
    });

    companyIdMap.set(company.id, result.id);

    if (result.created) {
      companiesCreated++;
    } else {
      companiesUpdated++;
    }
  }
  console.log(`  Created: ${companiesCreated}, Updated: ${companiesUpdated}\n`);

  // Step 3: Import users
  console.log('Step 3: Importing users...');
  let usersCreated = 0;
  let usersUpdated = 0;
  let usersSkipped = 0;

  for (const profile of exportData.userProfiles) {
    const email = exportData.userEmailMap[profile.user_id];

    if (!email) {
      console.warn(`  Warning: No email found for user ${profile.user_id}, skipping`);
      usersSkipped++;
      continue;
    }

    // Map role - Supabase has 'super_admin' and 'customer', add 'admin' as default for others
    let role = profile.role;
    if (role !== 'super_admin' && role !== 'admin' && role !== 'customer') {
      role = 'customer';
    }

    const result = await client.mutation(api.migration.importUser, {
      supabaseUserId: profile.user_id,
      email: email,
      name: profile.full_name,
      role: role,
    });

    userIdMap.set(profile.user_id, result.id);

    if (result.created) {
      usersCreated++;
    } else {
      usersUpdated++;
    }
  }
  console.log(`  Created: ${usersCreated}, Updated: ${usersUpdated}, Skipped: ${usersSkipped}\n`);

  // Step 4: Import user-company associations
  console.log('Step 4: Importing user-company associations...');
  let associationsCreated = 0;
  let associationsExisted = 0;
  let associationsSkipped = 0;

  for (const uc of exportData.userCompanies) {
    const userConvexId = userIdMap.get(uc.user_id);
    const companyConvexId = companyIdMap.get(uc.company_id);

    if (!userConvexId || !companyConvexId) {
      console.warn(`  Warning: Missing mapping for user ${uc.user_id} or company ${uc.company_id}`);
      associationsSkipped++;
      continue;
    }

    const result = await client.mutation(api.migration.importUserCompany, {
      userConvexId,
      companyConvexId,
    });

    if (result.created) {
      associationsCreated++;
    } else {
      associationsExisted++;
    }
  }
  console.log(`  Created: ${associationsCreated}, Existed: ${associationsExisted}, Skipped: ${associationsSkipped}\n`);

  // Step 5: Import domain assignments (if any)
  if (exportData.domainAssignments && exportData.domainAssignments.length > 0) {
    console.log('Step 5: Importing domain assignments...');
    let domainsAssigned = 0;
    let domainsNotFound = 0;
    let domainsSkipped = 0;

    for (const assignment of exportData.domainAssignments) {
      const companyConvexId = companyIdMap.get(assignment.company_id);

      if (!companyConvexId) {
        console.warn(`  Warning: Company not found for assignment: ${assignment.company_id}`);
        domainsSkipped++;
        continue;
      }

      const result = await client.mutation(api.migration.importDomainAssignment, {
        domainName: assignment.domain_name,
        companyConvexId,
      });

      if (result.success) {
        domainsAssigned++;
      } else {
        domainsNotFound++;
      }
    }
    console.log(`  Assigned: ${domainsAssigned}, Not found: ${domainsNotFound}, Skipped: ${domainsSkipped}\n`);
  }

  // Print summary
  console.log('Migration Complete!');
  console.log('==================');
  console.log(`Companies: ${companiesCreated} created, ${companiesUpdated} updated`);
  console.log(`Users: ${usersCreated} created, ${usersUpdated} updated, ${usersSkipped} skipped`);
  console.log(`Associations: ${associationsCreated} created, ${associationsExisted} existed`);

  // Save ID mappings for reference
  const mappings = {
    migratedAt: new Date().toISOString(),
    companies: Object.fromEntries(companyIdMap),
    users: Object.fromEntries(userIdMap),
  };

  const mappingsPath = join(__dirname, 'id-mappings.json');
  const { writeFileSync } = await import('fs');
  writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2));
  console.log(`\nID mappings saved to: ${mappingsPath}`);
}

importData().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
