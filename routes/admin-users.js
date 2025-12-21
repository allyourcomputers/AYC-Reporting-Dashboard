const express = require('express');
const router = express.Router();
const { supabase } = require('../middleware/company-context');
const logger = require('../logger');

// Middleware to verify super admin access
function requireSuperAdmin(req, res, next) {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

/**
 * GET /api/admin/users
 * List all users with their profiles and company assignments
 */
router.get('/', requireSuperAdmin, async (req, res) => {
  try {
    // Get all user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select(`
        user_id,
        full_name,
        role,
        active_company_id,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    if (profilesError) {
      logger.error('Failed to fetch user profiles', { error: profilesError });
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    // Get company assignments for all users
    const { data: userCompanies, error: companiesError } = await supabase
      .from('user_companies')
      .select(`
        user_id,
        company_id,
        companies (
          id,
          name
        )
      `);

    if (companiesError) {
      logger.error('Failed to fetch user companies', { error: companiesError });
      return res.status(500).json({ error: 'Failed to fetch user companies' });
    }

    // Get auth user emails (using admin API)
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      logger.error('Failed to fetch auth users', { error: authError });
      return res.status(500).json({ error: 'Failed to fetch auth users' });
    }

    // Create email lookup map
    const emailMap = new Map();
    authUsers.forEach(user => {
      emailMap.set(user.id, user.email);
    });

    // Build response with company assignments
    const users = profiles.map(profile => {
      const companies = userCompanies
        .filter(uc => uc.user_id === profile.user_id)
        .map(uc => ({
          id: uc.companies.id,
          name: uc.companies.name
        }));

      return {
        id: profile.user_id,
        email: emailMap.get(profile.user_id) || 'Unknown',
        fullName: profile.full_name,
        role: profile.role,
        activeCompanyId: profile.active_company_id,
        companies,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      };
    });

    res.json({ users });
  } catch (error) {
    logger.error('Error fetching users', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/users
 * Create a new user with profile and company assignments
 *
 * Body:
 * {
 *   email: string,
 *   password: string,
 *   fullName: string,
 *   role: 'super_admin' | 'customer',
 *   companyIds: string[] (UUIDs)
 * }
 */
router.post('/', requireSuperAdmin, async (req, res) => {
  try {
    const { email, password, fullName, role, companyIds } = req.body;

    // Validate input
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['super_admin', 'customer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role === 'customer' && (!companyIds || companyIds.length === 0)) {
      return res.status(400).json({ error: 'Customer users must be assigned to at least one company' });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      logger.error('Failed to create auth user', { error: authError, email });
      return res.status(400).json({ error: authError.message || 'Failed to create user' });
    }

    const userId = authData.user.id;

    // Determine active company (first in list for customers)
    const activeCompanyId = role === 'customer' && companyIds?.length > 0 ? companyIds[0] : null;

    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: userId,
        full_name: fullName,
        role,
        active_company_id: activeCompanyId
      });

    if (profileError) {
      logger.error('Failed to create user profile', { error: profileError, userId });
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    // Create company assignments for customer users
    if (role === 'customer' && companyIds?.length > 0) {
      const assignments = companyIds.map(companyId => ({
        user_id: userId,
        company_id: companyId
      }));

      const { error: assignmentError } = await supabase
        .from('user_companies')
        .insert(assignments);

      if (assignmentError) {
        logger.error('Failed to create company assignments', { error: assignmentError, userId });
        // Rollback: delete profile and auth user
        await supabase.from('user_profiles').delete().eq('user_id', userId);
        await supabase.auth.admin.deleteUser(userId);
        return res.status(500).json({ error: 'Failed to assign companies' });
      }
    }

    logger.info('User created successfully', { userId, email, role });

    res.status(201).json({
      success: true,
      user: {
        id: userId,
        email,
        fullName,
        role,
        activeCompanyId
      }
    });
  } catch (error) {
    logger.error('Error creating user', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/users/:userId
 * Update user profile and company assignments
 *
 * Body:
 * {
 *   fullName?: string,
 *   role?: 'super_admin' | 'customer',
 *   companyIds?: string[]
 * }
 */
router.put('/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, role, companyIds } = req.body;

    // Validate that user exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update object
    const updates = {};
    if (fullName !== undefined) updates.full_name = fullName;
    if (role !== undefined) {
      if (!['super_admin', 'customer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.role = role;
    }

    // Update profile if there are changes
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', userId);

      if (updateError) {
        logger.error('Failed to update user profile', { error: updateError, userId });
        return res.status(500).json({ error: 'Failed to update user' });
      }
    }

    // Update company assignments if provided
    if (companyIds !== undefined) {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from('user_companies')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        logger.error('Failed to delete existing company assignments', { error: deleteError, userId });
        return res.status(500).json({ error: 'Failed to update company assignments' });
      }

      // Create new assignments
      if (companyIds.length > 0) {
        const assignments = companyIds.map(companyId => ({
          user_id: userId,
          company_id: companyId
        }));

        const { error: insertError } = await supabase
          .from('user_companies')
          .insert(assignments);

        if (insertError) {
          logger.error('Failed to create company assignments', { error: insertError, userId });
          return res.status(500).json({ error: 'Failed to assign companies' });
        }

        // Update active company to first in list if not already set or invalid
        const newActiveCompanyId = companyIds.includes(existingProfile.active_company_id)
          ? existingProfile.active_company_id
          : companyIds[0];

        await supabase
          .from('user_profiles')
          .update({ active_company_id: newActiveCompanyId, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
      } else {
        // No companies assigned, clear active company
        await supabase
          .from('user_profiles')
          .update({ active_company_id: null, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
      }
    }

    logger.info('User updated successfully', { userId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating user', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user and all associated data
 */
router.delete('/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const { data: profile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (fetchError || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete auth user (cascades to profile and companies via foreign keys)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      logger.error('Failed to delete user', { error: deleteError, userId });
      return res.status(500).json({ error: 'Failed to delete user' });
    }

    logger.info('User deleted successfully', { userId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting user', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
