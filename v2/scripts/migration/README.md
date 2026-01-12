# Data Migration: Supabase to Convex

This directory contains scripts for migrating data from the existing Supabase database to the new Convex backend.

## Prerequisites

1. Node.js 18+
2. Access to both Supabase and Convex environments
3. Required npm packages (install from project root):
   ```bash
   npm install @supabase/supabase-js
   ```

## Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Supabase (for export)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Convex (for import)
CONVEX_URL=https://your-deployment.convex.cloud
# Or use VITE_CONVEX_URL from your .env.local
```

## Migration Steps

### Step 1: Export from Supabase

```bash
node scripts/migration/export-supabase.mjs
```

This creates `supabase-export.json` containing:
- Companies
- HaloPSA client mappings
- User profiles
- User-company associations
- Domain assignments (if table exists)

### Step 2: Sync External Data (Optional)

Before importing, you may want to sync data from external sources:

```bash
# Start development server
npm run dev

# In browser, go to /admin/sync and run:
# - Full Sync All (syncs HaloPSA clients, tickets, feedback, and 20i domains)
```

This ensures domains exist in Convex before importing domain assignments.

### Step 3: Import to Convex

```bash
node scripts/migration/import-to-convex.mjs
```

This imports:
1. Companies (with HaloPSA client ID mappings)
2. Users (profiles with email lookup)
3. User-company associations
4. Domain assignments (linking domains to companies)

Creates `id-mappings.json` for reference mapping Supabase IDs to Convex IDs.

## What Gets Migrated

| Supabase Table | Convex Table | Notes |
|---------------|--------------|-------|
| companies | companies | Includes HaloPSA client ID |
| user_profiles | users | Role mapping preserved |
| user_companies | userCompanies | Association preserved |
| domain_assignments | domains.companyId | Updates existing domains |

## What Gets Re-Synced

The following data is synced fresh from external APIs rather than migrated:

- **Tickets** - Re-synced from HaloPSA
- **Feedback** - Re-synced from HaloPSA
- **Domains** - Re-synced from 20i

## User Authentication

After migration:

1. Users will need to sign in via Clerk
2. On first Clerk sign-in, the user's `clerkId` is automatically populated
3. Users are matched by email address

## Troubleshooting

### "Export file not found"
Run `export-supabase.mjs` first to create the export file.

### "SUPABASE_SERVICE_ROLE_KEY required"
Set the environment variable with your Supabase service role key (found in Supabase Dashboard > Settings > API).

### "Domain not found"
Run the 20i sync before importing domain assignments to ensure domains exist in Convex.

### Users can't sign in
Ensure the user's email in Clerk matches the email from Supabase. The match is case-insensitive.

## Rollback

To clear all migrated data and start fresh:

```javascript
// In Convex dashboard or via script:
import { api } from './convex/_generated/api';
await client.mutation(api.migration.clearAllData, {
  confirm: "I_UNDERSTAND_THIS_DELETES_EVERYTHING"
});
```

**Warning**: This deletes ALL data in the database, not just migrated data.
