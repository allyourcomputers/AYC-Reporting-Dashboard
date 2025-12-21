-- =====================================================
-- Multi-Tenant Company Dashboard Migration
-- =====================================================
-- This migration transforms the system into a multi-tenant
-- architecture with company-based data isolation
-- =====================================================

-- =====================================================
-- SECTION 1: CREATE NEW TABLES
-- =====================================================

-- Companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User profiles (extends auth.users)
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'customer')),
  active_company_id UUID REFERENCES companies(id),
  impersonating_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many: users to companies
CREATE TABLE user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, company_id)
);

-- Company to HaloPSA client mappings
CREATE TABLE company_halopsa_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  halopsa_client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, halopsa_client_id)
);

-- Company to NinjaOne organization mappings
CREATE TABLE company_ninjaone_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ninjaone_org_id INTEGER NOT NULL,
  ninjaone_org_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, ninjaone_org_id)
);

-- =====================================================
-- SECTION 2: CREATE INDEXES
-- =====================================================

CREATE INDEX idx_user_companies_user_id ON user_companies(user_id);
CREATE INDEX idx_user_companies_company_id ON user_companies(company_id);
CREATE INDEX idx_company_halopsa_clients_company_id ON company_halopsa_clients(company_id);
CREATE INDEX idx_company_halopsa_clients_halopsa_client_id ON company_halopsa_clients(halopsa_client_id);
CREATE INDEX idx_company_ninjaone_orgs_company_id ON company_ninjaone_orgs(company_id);
CREATE INDEX idx_company_ninjaone_orgs_ninjaone_org_id ON company_ninjaone_orgs(ninjaone_org_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_active_company_id ON user_profiles(active_company_id);

-- =====================================================
-- SECTION 3: CREATE HELPER FUNCTIONS
-- =====================================================

-- Get effective user ID (impersonated user if active, otherwise current user)
CREATE OR REPLACE FUNCTION get_effective_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(impersonating_user_id, user_id)
  FROM user_profiles
  WHERE user_id = auth.uid();
$$;

-- Get user's active company ID (respects impersonation)
CREATE OR REPLACE FUNCTION get_user_active_company()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT active_company_id
  FROM user_profiles
  WHERE user_id = get_effective_user_id();
$$;

-- Check if user is super admin (actual user, not impersonated)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Check if currently impersonating
CREATE OR REPLACE FUNCTION is_impersonating()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT impersonating_user_id IS NOT NULL
  FROM user_profiles
  WHERE user_id = auth.uid();
$$;

-- Switch active company
CREATE OR REPLACE FUNCTION switch_active_company(new_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to this company
  IF NOT EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_id = auth.uid() AND company_id = new_company_id
  ) THEN
    RETURN FALSE;
  END IF;

  -- Update active company
  UPDATE user_profiles
  SET active_company_id = new_company_id, updated_at = CURRENT_TIMESTAMP
  WHERE user_id = auth.uid();

  RETURN TRUE;
END;
$$;

-- Start impersonation (super admin only)
CREATE OR REPLACE FUNCTION start_impersonation(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin() THEN
    RETURN FALSE;
  END IF;

  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = target_user_id) THEN
    RETURN FALSE;
  END IF;

  -- Set impersonation
  UPDATE user_profiles
  SET impersonating_user_id = target_user_id, updated_at = CURRENT_TIMESTAMP
  WHERE user_id = auth.uid();

  RETURN TRUE;
END;
$$;

-- Stop impersonation
CREATE OR REPLACE FUNCTION stop_impersonation()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear impersonation
  UPDATE user_profiles
  SET impersonating_user_id = NULL, updated_at = CURRENT_TIMESTAMP
  WHERE user_id = auth.uid();

  RETURN TRUE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_effective_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_active_company() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_impersonating() TO authenticated;
GRANT EXECUTE ON FUNCTION switch_active_company(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION start_impersonation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION stop_impersonation() TO authenticated;

-- =====================================================
-- SECTION 4: ENABLE RLS ON NEW TABLES
-- =====================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_halopsa_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_ninjaone_orgs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECTION 5: CREATE RLS POLICIES FOR NEW TABLES
-- =====================================================

-- Companies table policies
CREATE POLICY "Super admins view all companies" ON companies
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Users view their companies" ON companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
  );

CREATE POLICY "Super admins manage companies" ON companies
  FOR ALL USING (is_super_admin());

CREATE POLICY "Service role full access to companies" ON companies
  FOR ALL USING (auth.role() = 'service_role');

-- User profiles policies
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Super admins view all profiles" ON user_profiles
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admins manage profiles" ON user_profiles
  FOR ALL USING (is_super_admin());

CREATE POLICY "Users update own active company" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access to profiles" ON user_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- User companies junction policies
CREATE POLICY "Users view own assignments" ON user_companies
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Super admins view all assignments" ON user_companies
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admins manage assignments" ON user_companies
  FOR ALL USING (is_super_admin());

CREATE POLICY "Service role full access to user_companies" ON user_companies
  FOR ALL USING (auth.role() = 'service_role');

-- Company HaloPSA mappings policies
CREATE POLICY "Super admins view all HaloPSA mappings" ON company_halopsa_clients
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admins manage HaloPSA mappings" ON company_halopsa_clients
  FOR ALL USING (is_super_admin());

CREATE POLICY "Users view their HaloPSA mappings" ON company_halopsa_clients
  FOR SELECT USING (company_id = get_user_active_company());

CREATE POLICY "Service role full access to HaloPSA mappings" ON company_halopsa_clients
  FOR ALL USING (auth.role() = 'service_role');

-- Company NinjaOne mappings policies
CREATE POLICY "Super admins view all NinjaOne mappings" ON company_ninjaone_orgs
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admins manage NinjaOne mappings" ON company_ninjaone_orgs
  FOR ALL USING (is_super_admin());

CREATE POLICY "Users view their NinjaOne mappings" ON company_ninjaone_orgs
  FOR SELECT USING (company_id = get_user_active_company());

CREATE POLICY "Service role full access to NinjaOne mappings" ON company_ninjaone_orgs
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- SECTION 6: UPDATE EXISTING TABLE POLICIES
-- =====================================================

-- Drop old overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated read access to clients" ON clients;
DROP POLICY IF EXISTS "Allow public read access to clients" ON clients;

-- Clients table - company filtered
CREATE POLICY "Super admins view all clients" ON clients
  FOR SELECT USING (is_super_admin() AND NOT is_impersonating());

CREATE POLICY "Users view company clients" ON clients
  FOR SELECT USING (
    id IN (
      SELECT halopsa_client_id FROM company_halopsa_clients
      WHERE company_id = get_user_active_company()
    )
  );

CREATE POLICY "Service role full access to clients" ON clients
  FOR ALL USING (auth.role() = 'service_role');

-- Drop old ticket policies
DROP POLICY IF EXISTS "Allow authenticated read access to tickets" ON tickets;
DROP POLICY IF EXISTS "Allow public read access to tickets" ON tickets;

-- Tickets table - filtered via client
CREATE POLICY "Super admins view all tickets" ON tickets
  FOR SELECT USING (is_super_admin() AND NOT is_impersonating());

CREATE POLICY "Users view company tickets" ON tickets
  FOR SELECT USING (
    client_id IN (
      SELECT halopsa_client_id FROM company_halopsa_clients
      WHERE company_id = get_user_active_company()
    )
  );

CREATE POLICY "Service role full access to tickets" ON tickets
  FOR ALL USING (auth.role() = 'service_role');

-- Drop old feedback policies
DROP POLICY IF EXISTS "Allow authenticated read access to feedback" ON feedback;
DROP POLICY IF EXISTS "Allow public read access to feedback" ON feedback;

-- Feedback table - filtered via ticket -> client
CREATE POLICY "Super admins view all feedback" ON feedback
  FOR SELECT USING (is_super_admin() AND NOT is_impersonating());

CREATE POLICY "Users view company feedback" ON feedback
  FOR SELECT USING (
    ticket_id IN (
      SELECT t.id FROM tickets t
      INNER JOIN company_halopsa_clients chc ON t.client_id = chc.halopsa_client_id
      WHERE chc.company_id = get_user_active_company()
    )
  );

CREATE POLICY "Service role full access to feedback" ON feedback
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- SECTION 7: DATA MIGRATION
-- =====================================================

-- Create default company for existing data
INSERT INTO companies (id, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'Default Company', CURRENT_TIMESTAMP);

-- Map all existing HaloPSA clients to default company
INSERT INTO company_halopsa_clients (company_id, halopsa_client_id, created_at)
SELECT '00000000-0000-0000-0000-000000000001'::UUID, id, CURRENT_TIMESTAMP
FROM clients;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Note: After running this migration:
-- 1. Create your first super admin user in Supabase Auth UI
-- 2. Then run: INSERT INTO user_profiles (user_id, full_name, role) VALUES ('<user-id>', 'Admin', 'super_admin');
-- 3. Existing users will need profiles created via the admin interface
