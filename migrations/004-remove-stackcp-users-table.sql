-- =====================================================
-- Remove 20i StackCP Users Table Migration
-- =====================================================
-- This migration removes the company_20i_stackcp_users table
-- as we now use direct domain-to-company assignments instead
-- =====================================================

-- Drop the table (this will cascade delete all data and policies)
DROP TABLE IF EXISTS company_20i_stackcp_users CASCADE;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
