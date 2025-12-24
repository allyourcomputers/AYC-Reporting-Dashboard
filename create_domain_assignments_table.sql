-- Create table for direct domain to company assignments
-- This allows manual assignment of 20i domains to companies
-- bypassing the complexity of Stack Users

CREATE TABLE IF NOT EXISTS company_domain_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain_name)  -- Each domain can only be assigned to one company
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_domain_assignments_company_id
  ON company_domain_assignments(company_id);

CREATE INDEX IF NOT EXISTS idx_company_domain_assignments_domain_name
  ON company_domain_assignments(domain_name);

-- Add RLS policies
ALTER TABLE company_domain_assignments ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins can manage domain assignments"
  ON company_domain_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Users can view assignments for their companies
CREATE POLICY "Users can view their company domain assignments"
  ON company_domain_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_companies
      WHERE user_companies.user_id = auth.uid()
      AND user_companies.company_id = company_domain_assignments.company_id
    )
  );

COMMENT ON TABLE company_domain_assignments IS
  'Direct assignment of 20i domains to companies. Simpler alternative to Stack User mapping.';
