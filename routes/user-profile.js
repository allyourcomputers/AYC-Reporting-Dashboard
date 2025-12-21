const express = require('express');
const router = express.Router();
const { supabase } = require('../middleware/company-context');
const logger = require('../logger');

/**
 * GET /api/profile
 * Get current user profile with companies and impersonation status
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile', { error: profileError, userId });
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Get user's companies
    const { data: userCompanies, error: companiesError } = await supabase
      .from('user_companies')
      .select(`
        company_id,
        companies (
          id,
          name,
          logo_url
        )
      `)
      .eq('user_id', userId);

    if (companiesError) {
      logger.error('Failed to fetch user companies', { error: companiesError, userId });
      return res.status(500).json({ error: 'Failed to fetch companies' });
    }

    const companies = userCompanies.map(uc => ({
      id: uc.companies.id,
      name: uc.companies.name,
      logoUrl: uc.companies.logo_url
    }));

    // Get current user's email from auth
    const { data: { user: currentAuthUser }, error: currentAuthError } = await supabase.auth.admin.getUserById(userId);
    const currentUserEmail = currentAuthUser?.email || 'Unknown';

    // Check if currently impersonating
    const isImpersonating = profile.impersonating_user_id !== null;
    let impersonatedUser = null;

    if (isImpersonating) {
      // Get impersonated user details
      const { data: impersonatedProfile, error: impersonatedError } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, role, active_company_id')
        .eq('user_id', profile.impersonating_user_id)
        .single();

      if (!impersonatedError && impersonatedProfile) {
        // Get auth user email
        const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(
          profile.impersonating_user_id
        );

        impersonatedUser = {
          id: impersonatedProfile.user_id,
          email: authUser?.email || 'Unknown',
          fullName: impersonatedProfile.full_name,
          role: impersonatedProfile.role,
          activeCompanyId: impersonatedProfile.active_company_id
        };
      }
    }

    res.json({
      id: profile.user_id,
      email: currentUserEmail,
      fullName: profile.full_name,
      role: profile.role,
      activeCompanyId: profile.active_company_id,
      companies,
      isImpersonating,
      impersonatedUser
    });
  } catch (error) {
    logger.error('Error fetching user profile', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/profile/switch-company
 * Switch the user's active company
 *
 * Body:
 * {
 *   companyId: string (UUID)
 * }
 */
router.post('/switch-company', async (req, res) => {
  try {
    const userId = req.user.id;
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    // Use the database function to switch company (validates access)
    const { data, error } = await supabase.rpc('switch_active_company', {
      new_company_id: companyId
    });

    if (error) {
      logger.error('Failed to switch company', { error, userId, companyId });
      return res.status(500).json({ error: 'Failed to switch company' });
    }

    if (!data) {
      return res.status(403).json({ error: 'You do not have access to this company' });
    }

    logger.info('Company switched successfully', { userId, companyId });

    res.json({ success: true, activeCompanyId: companyId });
  } catch (error) {
    logger.error('Error switching company', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/profile/impersonate/:userId
 * Start impersonating another user (super admin only)
 */
router.post('/impersonate/:targetUserId', async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const { targetUserId } = req.params;

    // Verify caller is super admin
    const { data: adminProfile, error: adminError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || !adminProfile || adminProfile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    // Verify target user exists
    const { data: targetProfile, error: targetError } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, role')
      .eq('user_id', targetUserId)
      .single();

    if (targetError || !targetProfile) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Use the database function to start impersonation
    const { data, error } = await supabase.rpc('start_impersonation', {
      admin_user_id: adminUserId,
      target_user_id: targetUserId
    });

    if (error) {
      logger.error('Failed to start impersonation', { error, adminUserId, targetUserId });
      return res.status(500).json({ error: 'Failed to start impersonation' });
    }

    if (!data) {
      return res.status(403).json({ error: 'Cannot impersonate this user' });
    }

    logger.info('Impersonation started', {
      adminUserId,
      targetUserId,
      targetName: targetProfile.full_name
    });

    res.json({
      success: true,
      impersonating: {
        id: targetProfile.user_id,
        fullName: targetProfile.full_name,
        role: targetProfile.role
      }
    });
  } catch (error) {
    logger.error('Error starting impersonation', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/profile/stop-impersonation
 * Stop impersonating and return to admin view
 */
router.post('/stop-impersonation', async (req, res) => {
  try {
    const userId = req.user.id;

    // Use the database function to stop impersonation
    const { data, error } = await supabase.rpc('stop_impersonation', {
      admin_user_id: userId
    });

    if (error) {
      logger.error('Failed to stop impersonation', { error, userId });
      return res.status(500).json({ error: 'Failed to stop impersonation' });
    }

    logger.info('Impersonation stopped', { userId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error stopping impersonation', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
