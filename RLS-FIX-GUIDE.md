# Row Level Security (RLS) Fix Guide

## Problem
The sync service is failing with RLS policy violations because:
1. RLS was enabled on tables but no policies were created
2. The application was using the wrong Supabase key (anon key instead of service_role key)

## Solution Overview
This fix implements two changes:
1. **Add proper RLS policies** to all tables
2. **Use separate Supabase keys** for backend (service_role) and frontend (anon)

---

## Step 1: Update Supabase RLS Policies

Run the SQL script `fix-rls-policies.sql` in your Supabase SQL Editor:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `fix-rls-policies.sql`
5. Click **Run**

This will create policies that:
- Allow **authenticated users** to READ all data
- Allow **service_role** to READ and WRITE all data (for sync service)
- Allow **anon users** to READ data (for public access)

---

## Step 2: Get Your Supabase Keys

You need TWO different keys from Supabase:

1. Go to your Supabase Dashboard
2. Navigate to **Settings > API**
3. Copy these keys:
   - **`anon` `public`** key - for frontend authentication
   - **`service_role` `secret`** key - for backend sync operations

**IMPORTANT:** The `service_role` key is secret and should NEVER be exposed to the frontend!

---

## Step 3: Update Your .env File

Update your `.env` file with BOTH keys:

```bash
# HaloPSA API Configuration
HALO_API_URL=https://helpdesk.allyourcomputers.co.uk/api
HALO_CLIENT_ID=your-client-id
HALO_CLIENT_SECRET=your-client-secret

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co

# IMPORTANT: Use your service_role key here (the secret one)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...

# Use your anon key here (the public one)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...

# Server Configuration
PORT=3100
```

---

## Step 4: Verify Your Setup

Run the verification script:

```bash
./verify-setup.sh
```

This will check:
- `.env` file exists
- All required environment variables are set
- No placeholder values remain

---

## Step 5: Deploy the Fix

Deploy the updated code:

```bash
./deploy.sh
```

Or for a quick deployment:

```bash
./quick-deploy.sh
```

---

## Step 6: Verify the Fix

1. **Check the logs** to ensure all environment variables are loaded:
   ```bash
   docker logs halo-reporting
   ```

   You should see:
   ```
   Environment check:
   - SUPABASE_URL: Set (https://xxx...)
   - SUPABASE_SERVICE_ROLE_KEY: Set (eyJh...)
   - SUPABASE_ANON_KEY: Set (eyJh...)
   - HALO_API_URL: Set
   - HALO_CLIENT_ID: Set
   - HALO_CLIENT_SECRET: Set
   ```

2. **Check the sync logs**:
   ```bash
   docker exec -it halo-reporting tail -f /var/log/sync.log
   ```

   The sync should complete successfully without RLS errors.

3. **Test the login**:
   - Navigate to `http://your-server:3100/login`
   - Log in with your Supabase credentials
   - You should be able to view the dashboard

---

## What Changed?

### Before:
- Used one `SUPABASE_KEY` for everything
- No RLS policies existed (only RLS was enabled)
- Sync service couldn't write to database

### After:
- Uses `SUPABASE_SERVICE_ROLE_KEY` for backend sync operations (bypasses RLS)
- Uses `SUPABASE_ANON_KEY` for frontend authentication (respects RLS)
- Proper RLS policies allow authenticated users to read and service_role to write

---

## Troubleshooting

### "SUPABASE_SERVICE_ROLE_KEY must be set" error
- Make sure you added both new keys to your `.env` file
- Verify there are no typos in the variable names
- Run `./verify-setup.sh` to check

### Sync still fails with RLS errors
- Make sure you ran the `fix-rls-policies.sql` script in Supabase
- Verify you're using the `service_role` key, not the `anon` key
- Check the logs: `docker logs halo-reporting`

### Login shows "Failed to Fetch"
- Check that `SUPABASE_ANON_KEY` is set correctly
- Verify the frontend is receiving the anon key: `curl http://your-server:3100/api/config`
- Should return: `{"supabaseUrl":"...","supabaseAnonKey":"eyJh..."}`

---

## Security Note

**Never commit the `service_role` key to Git!**

The `.env` file is already in `.gitignore`, but double-check:
- Never put the service_role key in code comments
- Never log the full key value
- Only use it in backend code, never send it to the frontend

The service_role key has full database access and bypasses all RLS policies!
