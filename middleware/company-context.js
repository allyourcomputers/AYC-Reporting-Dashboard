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

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role, active_company_id')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      return res.status(403).json({
        error: 'User profile not found. Contact administrator.'
      });
    }

    // Customer users must have an active company
    if (profile.role === 'customer' && !profile.active_company_id) {
      return res.status(403).json({
        error: 'No active company. Contact administrator.'
      });
    }

    // Inject context into request
    req.userProfile = profile;
    req.isSuperAdmin = profile.role === 'super_admin';
    req.activeCompanyId = profile.active_company_id;

    next();
  } catch (error) {
    console.error('Company context error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { injectCompanyContext, supabase };
