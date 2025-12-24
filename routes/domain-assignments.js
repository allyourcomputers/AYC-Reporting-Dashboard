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
 * GET /api/admin/domain-assignments
 * Get all domain to company assignments
 */
router.get('/', requireSuperAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('company_domain_assignments')
      .select('*')
      .order('domain_name');

    if (error) {
      logger.error('Failed to fetch domain assignments', { error });
      return res.status(500).json({ error: 'Failed to fetch domain assignments' });
    }

    res.json({ assignments: data || [] });
  } catch (error) {
    logger.error('Error fetching domain assignments', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/domain-assignments
 * Assign domains to a company (upsert)
 *
 * Body:
 * {
 *   assignments: [{ domain_name: string, company_id: string }]
 * }
 */
router.post('/', requireSuperAdmin, async (req, res) => {
  try {
    const { assignments } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'assignments array is required' });
    }

    // Validate each assignment has required fields
    for (const assignment of assignments) {
      if (!assignment.domain_name || !assignment.company_id) {
        return res.status(400).json({
          error: 'Each assignment must have domain_name and company_id'
        });
      }
    }

    // Upsert assignments (insert or update if exists)
    const { error } = await supabase
      .from('company_domain_assignments')
      .upsert(assignments, {
        onConflict: 'domain_name',
        ignoreDuplicates: false
      });

    if (error) {
      logger.error('Failed to assign domains', { error, count: assignments.length });
      return res.status(500).json({ error: 'Failed to assign domains' });
    }

    logger.info('Domains assigned successfully', {
      count: assignments.length,
      companyId: assignments[0].company_id
    });

    res.json({ success: true, count: assignments.length });
  } catch (error) {
    logger.error('Error assigning domains', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/domain-assignments/:domainName
 * Remove a single domain assignment
 */
router.delete('/:domainName', requireSuperAdmin, async (req, res) => {
  try {
    const { domainName } = req.params;

    const { error } = await supabase
      .from('company_domain_assignments')
      .delete()
      .eq('domain_name', domainName);

    if (error) {
      logger.error('Failed to remove domain assignment', { error, domainName });
      return res.status(500).json({ error: 'Failed to remove domain assignment' });
    }

    logger.info('Domain assignment removed', { domainName });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing domain assignment', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/domain-assignments/company/:companyId
 * Remove all domain assignments for a company
 */
router.delete('/company/:companyId', requireSuperAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;

    const { error } = await supabase
      .from('company_domain_assignments')
      .delete()
      .eq('company_id', companyId);

    if (error) {
      logger.error('Failed to remove company domain assignments', { error, companyId });
      return res.status(500).json({ error: 'Failed to remove domain assignments' });
    }

    logger.info('Company domain assignments removed', { companyId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing company domain assignments', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
