# View Security Guide - SECURITY DEFINER vs SECURITY INVOKER

## What is the SECURITY DEFINER Warning?

Supabase shows this warning when a view is created with `SECURITY DEFINER` property (or without explicitly setting security mode, which defaults to `SECURITY DEFINER`).

### The Issue

**SECURITY DEFINER views:**
- Run with the **permissions of the view creator** (usually the database owner)
- **Bypass Row Level Security (RLS)** policies
- Can expose data that should be restricted
- Are considered a security risk in multi-tenant applications

**Example problem:**
- You have RLS policies to restrict data access
- A view with SECURITY DEFINER bypasses those policies
- Users can access restricted data through the view

## The Fix

Change the view to use **SECURITY INVOKER** instead:

### Before (SECURITY DEFINER - Bad):
```sql
CREATE OR REPLACE VIEW active_clients AS
SELECT * FROM clients WHERE ...;
```

### After (SECURITY INVOKER - Good):
```sql
CREATE OR REPLACE VIEW active_clients
WITH (security_invoker = true)
AS
SELECT * FROM clients WHERE ...;
```

## Quick Fix for Your Database

Run `fix-view-security.sql` in your Supabase SQL Editor:

```sql
-- Drop the existing view
DROP VIEW IF EXISTS active_clients;

-- Recreate with SECURITY INVOKER
CREATE OR REPLACE VIEW active_clients
WITH (security_invoker = true)
AS
SELECT DISTINCT
  c.id,
  c.name,
  c.toplevel_id,
  c.toplevel_name,
  c.inactive,
  c.colour,
  c.last_ticket_date,
  COUNT(t.id) as ticket_count_last_12_months
FROM clients c
INNER JOIN tickets t ON c.id = t.client_id
WHERE t.date_occurred >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY c.id, c.name, c.toplevel_id, c.toplevel_name, c.inactive, c.colour, c.last_ticket_date
ORDER BY c.name;
```

## Is This Safe for Your Application?

**YES, this change is completely safe** because:

1. ✅ Your app uses the **service role key** (full database access)
2. ✅ Service role bypasses RLS anyway
3. ✅ No change in functionality for your application
4. ✅ Just removes the security warning
5. ✅ Follows Supabase best practices

## Understanding the Difference

### SECURITY DEFINER (Default, Not Recommended)

```sql
CREATE VIEW my_view AS
  SELECT * FROM sensitive_table;
```

**How it works:**
- View runs with **creator's permissions**
- If creator has full access, **everyone querying the view has full access**
- **Bypasses RLS policies**

**Use case:**
- When you intentionally want to expose restricted data
- Rare in modern applications

### SECURITY INVOKER (Recommended)

```sql
CREATE VIEW my_view
WITH (security_invoker = true)
AS
  SELECT * FROM sensitive_table;
```

**How it works:**
- View runs with **querying user's permissions**
- **Respects RLS policies**
- Safer for multi-tenant applications

**Use case:**
- Default for most applications
- Recommended by Supabase

## Impact on Your Application

### Before Fix:
- ⚠️ Warning in Supabase dashboard
- ✅ App works fine (service role has full access)
- ⚠️ Not following best practices

### After Fix:
- ✅ No warning in Supabase dashboard
- ✅ App works exactly the same
- ✅ Following best practices
- ✅ Better security posture

## When SECURITY DEFINER Makes Sense

**Rare cases where SECURITY DEFINER is appropriate:**

1. **Intentional privilege escalation**: When you want to expose specific data to users who normally don't have access
2. **Performance optimization**: In some cases, running with creator's permissions can skip permission checks
3. **Legacy compatibility**: When migrating from systems that expect this behavior

**For your use case:** SECURITY INVOKER is the right choice.

## Verify the Fix

After running the fix script, verify:

```sql
-- Check view properties
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'active_clients';

-- Test that the view still works
SELECT * FROM active_clients LIMIT 5;
```

## Complete Fix for All Warnings

If you've been following along, here's the complete list of fixes:

### 1. Enable RLS (from previous fix)
```sql
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;
```

### 2. Fix View Security (this fix)
```sql
CREATE OR REPLACE VIEW active_clients
WITH (security_invoker = true)
AS ...
```

Both fixes are:
- ✅ Non-breaking
- ✅ Safe to apply immediately
- ✅ Follow Supabase best practices
- ✅ Remove dashboard warnings

## Troubleshooting

### View Query Fails After Fix

**Should NOT happen** because:
- Your app uses service role key
- Service role has full access
- SECURITY INVOKER doesn't affect service role

**If it does happen:**
1. Check your `SUPABASE_KEY` is the service role key (not anon key)
2. Verify RLS policies allow service role access
3. Check server logs for specific errors

### Want to Revert?

To go back to SECURITY DEFINER (not recommended):

```sql
DROP VIEW IF EXISTS active_clients;

CREATE OR REPLACE VIEW active_clients AS
SELECT DISTINCT
  c.id,
  c.name,
  ...
FROM clients c
INNER JOIN tickets t ON c.id = t.client_id
WHERE t.date_occurred >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY c.id, c.name, c.toplevel_id, c.toplevel_name, c.inactive, c.colour, c.last_ticket_date
ORDER BY c.name;
```

### Check All Views in Your Database

```sql
SELECT
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;
```

## Best Practices

Going forward:

1. ✅ **Always use SECURITY INVOKER** for new views
2. ✅ **Enable RLS** on all tables
3. ✅ **Use service role key** for server-side access
4. ✅ **Use anon key** for client-side access (if needed)
5. ✅ **Define specific RLS policies** for each access pattern

## Summary

**Quick Fix Steps:**

1. Open Supabase SQL Editor
2. Run `fix-view-security.sql`
3. Warning disappears
4. App continues working

**Why it's safe:**
- Your app uses service role key
- Service role has full access regardless of view security
- No functionality changes
- Just removes the warning

**Recommended action:**
✅ Run `fix-view-security.sql` - takes 5 seconds, no downtime, no app changes needed.

## Related Documentation

- [Supabase Views Documentation](https://supabase.com/docs/guides/database/views)
- [PostgreSQL View Security](https://www.postgresql.org/docs/current/sql-createview.html)
- [Row Level Security Guide](./RLS_GUIDE.md)
