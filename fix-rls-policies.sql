-- Comprehensive RLS Policy Fix for HaloPSA Reporting
-- This creates proper Row Level Security policies for all tables
-- Run this in your Supabase SQL Editor

-- ============================================
-- CLIENTS TABLE POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read access to clients" ON clients;
DROP POLICY IF EXISTS "Allow service role full access to clients" ON clients;

-- Create policy for authenticated users to read
CREATE POLICY "Allow authenticated read access to clients" ON clients
    FOR SELECT
    TO authenticated
    USING (true);

-- Create policy for service role to have full access (for sync service)
CREATE POLICY "Allow service role full access to clients" ON clients
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create policy for anon users to read (if needed for public access)
CREATE POLICY "Allow anon read access to clients" ON clients
    FOR SELECT
    TO anon
    USING (true);


-- ============================================
-- TICKETS TABLE POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read access to tickets" ON tickets;
DROP POLICY IF EXISTS "Allow service role full access to tickets" ON tickets;

-- Create policy for authenticated users to read
CREATE POLICY "Allow authenticated read access to tickets" ON tickets
    FOR SELECT
    TO authenticated
    USING (true);

-- Create policy for service role to have full access (for sync service)
CREATE POLICY "Allow service role full access to tickets" ON tickets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create policy for anon users to read (if needed for public access)
CREATE POLICY "Allow anon read access to tickets" ON tickets
    FOR SELECT
    TO anon
    USING (true);


-- ============================================
-- SYNC_METADATA TABLE POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read access to sync_metadata" ON sync_metadata;
DROP POLICY IF EXISTS "Allow service role full access to sync_metadata" ON sync_metadata;

-- Create policy for authenticated users to read
CREATE POLICY "Allow authenticated read access to sync_metadata" ON sync_metadata
    FOR SELECT
    TO authenticated
    USING (true);

-- Create policy for service role to have full access (for sync service)
CREATE POLICY "Allow service role full access to sync_metadata" ON sync_metadata
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create policy for anon users to read (if needed for public access)
CREATE POLICY "Allow anon read access to sync_metadata" ON sync_metadata
    FOR SELECT
    TO anon
    USING (true);


-- ============================================
-- FEEDBACK TABLE POLICIES (if exists)
-- ============================================

-- Check if feedback table exists and add policies
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'feedback') THEN

        -- Drop existing policies if any
        EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated read access to feedback" ON feedback';
        EXECUTE 'DROP POLICY IF EXISTS "Allow service role full access to feedback" ON feedback';
        EXECUTE 'DROP POLICY IF EXISTS "Allow public read access to feedback" ON feedback';
        EXECUTE 'DROP POLICY IF EXISTS "Allow anon read access to feedback" ON feedback';

        -- Create policy for authenticated users to read
        EXECUTE 'CREATE POLICY "Allow authenticated read access to feedback" ON feedback
            FOR SELECT
            TO authenticated
            USING (true)';

        -- Create policy for service role to have full access
        EXECUTE 'CREATE POLICY "Allow service role full access to feedback" ON feedback
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true)';

        -- Create policy for anon users to read
        EXECUTE 'CREATE POLICY "Allow anon read access to feedback" ON feedback
            FOR SELECT
            TO anon
            USING (true)';

        RAISE NOTICE 'Policies created for feedback table';
    ELSE
        RAISE NOTICE 'Feedback table does not exist, skipping policy creation';
    END IF;
END $$;


-- ============================================
-- VERIFICATION
-- ============================================

-- Show all policies for our tables
SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd as command,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('clients', 'tickets', 'sync_metadata', 'feedback')
ORDER BY tablename, policyname;

-- Summary: Count policies per table
SELECT
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename IN ('clients', 'tickets', 'sync_metadata', 'feedback')
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
