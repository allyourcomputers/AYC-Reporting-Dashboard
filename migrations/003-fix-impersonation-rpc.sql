-- Fix impersonation RPC functions to work with service role calls
-- The backend already verifies the user is a super admin before calling these functions

DROP FUNCTION IF EXISTS start_impersonation(UUID);
DROP FUNCTION IF EXISTS stop_impersonation();

-- Start impersonation - takes both admin user ID and target user ID
CREATE OR REPLACE FUNCTION start_impersonation(admin_user_id UUID, target_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = admin_user_id AND role = 'super_admin'
  ) THEN
    RETURN FALSE;
  END IF;

  -- Verify target user exists and is not a super admin (can't impersonate other admins)
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = target_user_id AND role = 'customer'
  ) THEN
    RETURN FALSE;
  END IF;

  -- Set impersonation
  UPDATE user_profiles
  SET impersonating_user_id = target_user_id, updated_at = CURRENT_TIMESTAMP
  WHERE user_id = admin_user_id;

  RETURN TRUE;
END;
$$;

-- Stop impersonation - takes admin user ID
CREATE OR REPLACE FUNCTION stop_impersonation(admin_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET impersonating_user_id = NULL, updated_at = CURRENT_TIMESTAMP
  WHERE user_id = admin_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION start_impersonation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION stop_impersonation(UUID) TO authenticated;
