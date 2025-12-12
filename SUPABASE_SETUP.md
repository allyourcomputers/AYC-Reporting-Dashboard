# Supabase Integration Setup Guide

This guide explains how to set up the HaloPSA Reporting Dashboard with Supabase for improved performance and data caching.

## Benefits of Using Supabase

1. **Faster Queries** - Data is cached locally in Supabase instead of querying HaloPSA API every time
2. **Active Client Filtering** - Only shows clients with tickets in the last 12 months
3. **Historical Data** - Keep ticket history even if it's old in HaloPSA
4. **Reduced API Calls** - Less load on HaloPSA API

## Setup Instructions

### 1. Get Supabase Credentials

You'll need:
- **SUPABASE_URL**: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- **SUPABASE_KEY**: Your Supabase anon/public key

You can find these in your Supabase project settings under "API".

### 2. Update Environment Variables

Add the following to your `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### 3. Create Database Tables

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Copy the contents of `setup-database.sql`
4. Paste it into the SQL editor and click "Run"

This will create:
- `clients` table - Stores client information
- `tickets` table - Stores ticket data
- `sync_metadata` table - Tracks sync history
- `active_clients` view - Filtered view of clients with tickets in last 12 months
- Indexes for performance
- Row Level Security policies

### 4. Initial Data Sync

Run the sync service to pull data from HaloPSA into Supabase:

```bash
node sync-service.js
```

By default, this syncs the last 12 months of tickets. You can specify a different number of months:

```bash
node sync-service.js 24  # Sync last 24 months
```

This will:
1. Fetch all clients from HaloPSA
2. Fetch all tickets from the specified time period
3. Store them in Supabase
4. Calculate which clients are "active" (have tickets in last 12 months)

### 5. Switch to Supabase Server

Replace your current server with the Supabase version:

```bash
# Stop the old server if running
# Then start the new one:
node server-supabase.js
```

Or update your `package.json` to use the new server:

```json
{
  "scripts": {
    "start": "node server-supabase.js"
  }
}
```

## API Endpoints

All existing endpoints work the same way, but now they query Supabase instead of HaloPSA directly:

- `GET /api/clients` - Returns only active clients (with tickets in last 12 months)
- `GET /api/tickets/stats?clientId=X&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Get ticket statistics
- `POST /api/tickets/monthly-stats` - Get monthly breakdown

### New Endpoints

- `POST /api/sync` - Trigger a background data sync from HaloPSA
- `GET /api/sync/status` - Check the status of recent syncs

## Keeping Data Fresh

You should run the sync periodically to keep your Supabase data up to date:

### Option 1: Manual Sync

Run the sync script manually:
```bash
node sync-service.js
```

### Option 2: API Trigger

Trigger a sync via the API:
```bash
curl -X POST http://localhost:3000/api/sync
```

### Option 3: Scheduled Sync (Recommended)

Set up a cron job to sync automatically:

```bash
# Edit your crontab
crontab -e

# Add a line to sync every night at 2 AM
0 2 * * * cd /path/to/halo-reporting && node sync-service.js >> sync.log 2>&1
```

Or use a service like Supabase Edge Functions or GitHub Actions to trigger syncs on a schedule.

## Troubleshooting

### "SUPABASE_URL and SUPABASE_KEY must be set"

Make sure you've added the Supabase credentials to your `.env` file.

### Sync fails with database errors

Make sure you've run the `setup-database.sql` script in your Supabase SQL editor first.

### No clients showing up

1. Check if the sync completed successfully: `GET /api/sync/status`
2. Make sure clients have tickets in the last 12 months
3. Check the `active_clients` view in Supabase to see what's being returned

### Performance issues

The first sync can take a while if you have a lot of tickets. Subsequent syncs will be faster as they update existing records.

## Comparing Old vs New

### Old Server (Direct HaloPSA)
- File: `server.js`
- Queries HaloPSA API directly
- Slower response times
- Shows all clients
- Limited by HaloPSA API rate limits

### New Server (Supabase)
- File: `server-supabase.js`
- Queries local Supabase database
- Fast response times
- Shows only active clients (last 12 months)
- No API rate limit concerns
- Requires periodic syncing

## Migration Path

1. Keep using `server.js` while setting up Supabase
2. Run initial sync with `sync-service.js`
3. Test the new server with `server-supabase.js`
4. Once verified, switch over permanently
5. Set up automated syncing

Both servers can coexist - you can run the old one while testing the new one on a different port.
