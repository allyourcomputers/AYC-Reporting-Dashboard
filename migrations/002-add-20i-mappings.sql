-- =====================================================
-- 20i StackCP Integration Migration
-- =====================================================
-- This migration adds support for mapping companies to
-- 20i StackCP users for domain and hosting management
-- =====================================================

-- =====================================================
-- CREATE TABLE: company_20i_stackcp_users
-- =====================================================
-- Maps companies to 20i StackCP user IDs
-- Follows the same pattern as company_ninjaone_orgs

CREATE TABLE company_20i_stackcp_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stackcp_user_id TEXT NOT NULL,
  stackcp_user_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, stackcp_user_id)
);

-- =====================================================
-- CREATE INDEXES
-- =====================================================

CREATE INDEX idx_company_20i_stackcp_users_company_id
  ON company_20i_stackcp_users(company_id);

CREATE INDEX idx_company_20i_stackcp_users_stackcp_user_id
  ON company_20i_stackcp_users(stackcp_user_id);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE company_20i_stackcp_users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================
-- These policies ensure multi-tenant data isolation
-- and proper access control for different user roles

-- Super admins can view all 20i mappings
CREATE POLICY "Super admins view all 20i mappings"
  ON company_20i_stackcp_users
  FOR SELECT
  USING (is_super_admin());

-- Super admins can manage (insert/update/delete) all 20i mappings
CREATE POLICY "Super admins manage 20i mappings"
  ON company_20i_stackcp_users
  FOR ALL
  USING (is_super_admin());

-- Regular users can view mappings for their active company
CREATE POLICY "Users view their 20i mappings"
  ON company_20i_stackcp_users
  FOR SELECT
  USING (company_id = get_user_active_company());

-- Service role (backend) has full access (bypasses RLS)
CREATE POLICY "Service role full access to 20i mappings"
  ON company_20i_stackcp_users
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next steps:
-- 1. Run this migration in Supabase dashboard
-- 2. Verify table and policies are created correctly
-- 3. Test RLS policies with different user roles
-- =====================================================
