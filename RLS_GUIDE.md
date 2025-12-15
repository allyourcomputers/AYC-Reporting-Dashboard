# Row Level Security (RLS) Guide

## What is the "Policy Exists RLS Disabled" Warning?

This warning appears in Supabase when:
- Your tables have **RLS policies** defined (security rules)
- But **RLS itself is disabled** on those tables
- This means the security policies are not being enforced

## Is This a Security Issue?

**For your setup: NO, it's safe** because:

1. **Server-side only access**: Your Node.js application uses the `SUPABASE_KEY` (service role key)
2. **Service role bypasses RLS**: The service role has full access regardless of RLS policies
3. **No direct browser access**: Users never directly query Supabase from their browsers
4. **API authentication**: Your Express.js server handles authentication via JWT tokens

However, it's still **best practice** to enable RLS to:
- Follow Supabase recommendations
- Remove the warning message
- Add an extra security layer
- Be prepared if you ever add client-side access

## How to Fix

### Option 1: Enable RLS (Recommended)

Run the provided SQL script in your Supabase SQL Editor:

1. Go to your Supabase dashboard: https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left menu
4. Click **New query**
5. Copy and paste the contents of `fix-rls.sql`
6. Click **Run** or press `Cmd/Ctrl + Enter`

**Expected output:**
```
schemaname | tablename      | rls_enabled
-----------+----------------+-------------
public     | clients        | true
public     | feedback       | true
public     | sync_metadata  | true
public     | tickets        | true
```

The warning should disappear immediately.

### Option 2: Verify Current RLS Status

To check which tables have RLS enabled:

```sql
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Option 3: Remove Policies (Not Recommended)

If you prefer to remove the policies instead of enabling RLS:

```sql
-- Drop all policies on clients table
DROP POLICY IF EXISTS "Allow public read access to clients" ON clients;
DROP POLICY IF EXISTS "Allow service role full access to clients" ON clients;

-- Drop all policies on tickets table
DROP POLICY IF EXISTS "Allow public read access to tickets" ON tickets;
DROP POLICY IF EXISTS "Allow service role full access to tickets" ON tickets;

-- Drop all policies on sync_metadata table
DROP POLICY IF EXISTS "Allow public read access to sync_metadata" ON sync_metadata;
DROP POLICY IF EXISTS "Allow service role full access to sync_metadata" ON sync_metadata;

-- Drop all policies on feedback table (if exists)
DROP POLICY IF EXISTS "Allow public read access to feedback" ON feedback;
DROP POLICY IF EXISTS "Allow service role full access to feedback" ON feedback;
```

**Note:** This is not recommended because it removes security layers.

## Understanding Your RLS Policies

Your database has these policies:

### 1. Public Read Access
```sql
CREATE POLICY "Allow public read access to clients" ON clients
  FOR SELECT USING (true);
```
- Allows anyone to **read** data
- Doesn't affect your app (service role bypasses this)
- Would only matter if you query from browser

### 2. Service Role Full Access
```sql
CREATE POLICY "Allow service role full access to clients" ON clients
  FOR ALL USING (auth.role() = 'service_role');
```
- Allows service role **full access** (read, write, update, delete)
- This is what your Node.js app uses
- Works whether RLS is enabled or not

## Best Practice: Keep RLS Enabled

Even though your app works fine without RLS, it's recommended to:

1. ✅ **Enable RLS** on all tables
2. ✅ **Keep the policies** as they are
3. ✅ **Use service role key** for server-side access (what you're doing now)
4. ✅ **Add more specific policies** if you ever need browser-side access

## Future: Adding Browser-Side Access

If you ever want to query Supabase directly from the browser (not recommended for your use case), you would:

1. Use the **anon key** instead of service role key in the browser
2. Add **specific RLS policies** for authenticated users
3. Use Supabase Auth to manage user sessions

Example policy for authenticated users:
```sql
CREATE POLICY "Authenticated users can read their own data" ON tickets
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

## Troubleshooting

### Warning Still Shows After Running fix-rls.sql

1. Refresh your Supabase dashboard
2. Clear browser cache
3. Check the query output to confirm RLS is enabled

### App Stopped Working After Enabling RLS

This should **NOT** happen because:
- Your app uses the service role key
- Service role bypasses RLS
- Policies explicitly allow service role full access

If it does happen:
1. Check your `SUPABASE_KEY` in `.env` is the service role key (not anon key)
2. Verify policies exist with: `\dp clients` in SQL editor
3. Check server logs for specific errors

### Need to Disable RLS Temporarily

```sql
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata DISABLE ROW LEVEL SECURITY;
```

Re-enable with:
```sql
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;
```

## Summary

**Quick Fix:**
1. Run `fix-rls.sql` in Supabase SQL Editor
2. Warning disappears
3. Your app continues working exactly as before

**Why it's safe:**
- Your app uses service role key
- Service role has full access regardless of RLS
- Enabling RLS just removes the warning and adds security best practices

**Recommended action:**
✅ Enable RLS by running `fix-rls.sql` - takes 5 seconds, no downtime, no app changes needed.
