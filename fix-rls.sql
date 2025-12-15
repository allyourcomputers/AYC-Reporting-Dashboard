-- Fix RLS Warning in Supabase
-- Run this in your Supabase SQL Editor to enable Row Level Security

-- Enable Row Level Security on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- Check if feedback table exists and enable RLS on it too
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'feedback') THEN
        ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Verify RLS is enabled
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('clients', 'tickets', 'sync_metadata', 'feedback')
ORDER BY tablename;
