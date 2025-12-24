-- =====================================================
-- Domain to Company Assignments Table Migration
-- =====================================================
-- This migration creates the table for manually assigning
-- 20i domains to companies
-- =====================================================

-- =====================================================
-- CREATE TABLE: company_domain_assignments
-- =====================================================
-- Maps domains to companies for manual assignment

CREATE TABLE IF NOT EXISTS company_domain_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_name TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CREATE INDEXES
-- =====================================================

CREATE INDEX idx_company_domain_assignments_company_id
  ON company_domain_assignments(company_id);

CREATE INDEX idx_company_domain_assignments_domain_name
  ON company_domain_assignments(domain_name);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE company_domain_assignments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Super admins can view all domain assignments
CREATE POLICY "Super admins view all domain assignments"
  ON company_domain_assignments
  FOR SELECT
  USING (is_super_admin());

-- Super admins can manage (insert/update/delete) all domain assignments
CREATE POLICY "Super admins manage domain assignments"
  ON company_domain_assignments
  FOR ALL
  USING (is_super_admin());

-- Regular users can view assignments for their active company
CREATE POLICY "Users view their domain assignments"
  ON company_domain_assignments
  FOR SELECT
  USING (company_id = get_user_active_company());

-- Service role (backend) has full access (bypasses RLS)
CREATE POLICY "Service role full access to domain assignments"
  ON company_domain_assignments
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
