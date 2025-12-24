const express = require('express');
const router = express.Router();
const { supabase } = require('../middleware/company-context');
const twentyiClient = require('../twentyi-client');
const logger = require('../logger');

/**
 * GET /api/domains
 * Get all domains from 20i with hosting status
 * Filtered by company domain assignments for non-admin users
 */
router.get('/', async (req, res) => {
  try {
    const data = await twentyiClient.getDomains();

    // Super admins see all domains
    if (req.isSuperAdmin) {
      return res.json(data);
    }

    // Regular users see only domains assigned to their company
    if (!req.activeCompanyId) {
      return res.status(403).json({ error: 'No active company assigned' });
    }

    // Get domain assignments for this company
    const { data: assignments, error } = await supabase
      .from('company_domain_assignments')
      .select('domain_name')
      .eq('company_id', req.activeCompanyId);

    if (error) {
      logger.error('Failed to fetch domain assignments', { error, companyId: req.activeCompanyId });
      return res.status(500).json({ error: 'Failed to fetch domain assignments' });
    }

    // Get list of allowed domain names
    const allowedDomains = new Set(assignments.map(a => a.domain_name.toLowerCase()));

    if (allowedDomains.size === 0) {
      // Company has no domains assigned, return empty result
      return res.json({
        summary: {
          totalDomains: 0,
          domainsWithHosting: 0,
          domainsExpiringSoon: 0
        },
        domains: [],
        lastUpdated: data.lastUpdated
      });
    }

    // Filter domains by assigned domain names
    const filteredDomains = data.domains.filter(domain =>
      allowedDomains.has(domain.name.toLowerCase())
    );

    // Recalculate summary for filtered domains
    const summary = {
      totalDomains: filteredDomains.length,
      domainsWithHosting: filteredDomains.filter(d => d.hasHosting).length,
      domainsExpiringSoon: filteredDomains.filter(d =>
        d.status === 'expiring-soon' || d.status === 'expired'
      ).length
    };

    res.json({
      summary,
      domains: filteredDomains,
      lastUpdated: data.lastUpdated
    });
  } catch (error) {
    logger.error('Failed to fetch domains', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch domains from 20i' });
  }
});

module.exports = router;
