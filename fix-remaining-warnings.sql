-- Fix Remaining Supabase Security Warnings
-- Run this in your Supabase SQL Editor

-- ============================================
-- FIX 1: Set search_path for function
-- ============================================

-- Drop and recreate the function with explicit search_path
DROP FUNCTION IF EXISTS update_client_last_ticket_dates();

CREATE OR REPLACE FUNCTION update_client_last_ticket_dates()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE clients c
  SET last_ticket_date = (
    SELECT MAX(date_occurred)
    FROM tickets t
    WHERE t.client_id = c.id
  );
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION update_client_last_ticket_dates() TO authenticated;
GRANT EXECUTE ON FUNCTION update_client_last_ticket_dates() TO service_role;


-- ============================================
-- FIX 2: Add RLS policies for feedback table
-- ============================================

-- Check if feedback table exists, if so add policies
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'feedback') THEN

        -- Drop existing policies if any
        DROP POLICY IF EXISTS "Allow public read access to feedback" ON feedback;
        DROP POLICY IF EXISTS "Allow service role full access to feedback" ON feedback;

        -- Create policy for public read access
        CREATE POLICY "Allow public read access to feedback" ON feedback
            FOR SELECT USING (true);

        -- Create policy for service role full access
        CREATE POLICY "Allow service role full access to feedback" ON feedback
            FOR ALL USING (auth.role() = 'service_role');

        RAISE NOTICE 'Policies created for feedback table';
    ELSE
        RAISE NOTICE 'Feedback table does not exist, skipping policy creation';
    END IF;
END $$;


-- ============================================
-- VERIFICATION
-- ============================================

-- Verify function has search_path set
SELECT
    proname as function_name,
    proconfig as settings
FROM pg_proc
WHERE proname = 'update_client_last_ticket_dates';

-- Verify feedback policies exist (if table exists)
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'feedback'
ORDER BY policyname;

-- Summary of all RLS-enabled tables and their policies
SELECT
    t.schemaname,
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename IN ('clients', 'tickets', 'sync_metadata', 'feedback')
GROUP BY t.schemaname, t.tablename, t.rowsecurity
ORDER BY t.tablename;
