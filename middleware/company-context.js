const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Middleware to inject company context into authenticated requests
 *
 * This middleware:
 * - Fetches the user's profile from the database
 * - Validates that the user has a profile and necessary permissions
 * - Injects company context into the request object:
 *   - req.userProfile: Full user profile with role and active company
 *   - req.isSuperAdmin: Boolean indicating if user is super admin
 *   - req.activeCompanyId: UUID of the user's active company (null for super admins)
 *
 * @param {Object} req - Express request object (must have req.user from auth middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function injectCompanyContext(req, res, next) {
  try {
    const userId = req.user.id;

    // Load the actual authenticated user's profile first
    const { data: actualProfile, error: actualError } = await supabase
      .from('user_profiles')
      .select('role, active_company_id, impersonating_user_id')
      .eq('user_id', userId)
      .single();

    if (actualError || !actualProfile) {
      return res.status(403).json({
        error: 'User profile not found. Contact administrator.'
      });
    }

    // Determine which profile to use for access control
    let effectiveProfile;
    let isRealSuperAdmin = actualProfile.role === 'super_admin';

    if (actualProfile.impersonating_user_id) {
      // Admin is impersonating - use the impersonated user's profile
      const { data: impersonatedProfile, error: impersonatedError } = await supabase
        .from('user_profiles')
        .select('role, active_company_id')
        .eq('user_id', actualProfile.impersonating_user_id)
        .single();

      if (impersonatedError || !impersonatedProfile) {
        return res.status(403).json({
          error: 'Impersonated user profile not found. Contact administrator.'
        });
      }

      effectiveProfile = {
        ...impersonatedProfile,
        impersonating_user_id: actualProfile.impersonating_user_id,
        isImpersonating: true
      };
    } else {
      // Not impersonating - use actual profile
      effectiveProfile = {
        ...actualProfile,
        isImpersonating: false
      };
    }

    // Customer users must have an active company
    if (effectiveProfile.role === 'customer' && !effectiveProfile.active_company_id) {
      return res.status(403).json({
        error: 'No active company. Contact administrator.'
      });
    }

    // Inject context into request
    // IMPORTANT: Use the effective profile (impersonated user if impersonating)
    req.userProfile = effectiveProfile;
    req.isSuperAdmin = effectiveProfile.role === 'super_admin';
    req.isRealSuperAdmin = isRealSuperAdmin; // Track if the REAL user is super admin
    req.activeCompanyId = effectiveProfile.active_company_id;

    next();
  } catch (error) {
    console.error('Company context error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { injectCompanyContext, supabase };
