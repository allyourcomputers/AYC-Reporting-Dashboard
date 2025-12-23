const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * GET /api/stack-users/:stackUserId/domains
 * Get all domains for a specific Stack User
 */
router.get('/:stackUserId/domains', async (req, res) => {
  try {
    const { stackUserId } = req.params;

    const { data, error } = await supabase
      .from('stack_user_domain_mappings')
      .select('domain_name, package_name, package_type, is_wordpress, is_enabled')
      .eq('stack_user_id', stackUserId)
      .order('domain_name');

    if (error) {
      console.error('Error fetching domains:', error);
      return res.status(500).json({ error: 'Failed to fetch domains' });
    }

    res.json({
      stackUserId,
      domains: data.map(d => d.domain_name),
      details: data
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stack-users/validate-domain
 * Validate if a Stack User owns a specific domain
 */
router.get('/validate-domain', async (req, res) => {
  try {
    const { stackUserId, domainName } = req.query;

    if (!stackUserId || !domainName) {
      return res.status(400).json({ error: 'stackUserId and domainName are required' });
    }

    const { data, error } = await supabase
      .from('stack_user_domain_mappings')
      .select('*')
      .eq('stack_user_id', stackUserId)
      .eq('domain_name', domainName)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error validating domain:', error);
      return res.status(500).json({ error: 'Failed to validate domain' });
    }

    res.json({
      valid: !!data,
      mapping: data || null
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stack-users/all
 * Get all Stack Users with their domain counts
 */
router.get('/all', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stack_user_domain_mappings')
      .select('stack_user_id, stack_user_ref, domain_name, package_type, is_wordpress');

    if (error) {
      console.error('Error fetching stack users:', error);
      return res.status(500).json({ error: 'Failed to fetch stack users' });
    }

    // Group by stack user
    const grouped = data.reduce((acc, row) => {
      if (!acc[row.stack_user_id]) {
        acc[row.stack_user_id] = {
          stackUserId: row.stack_user_id,
          stackUserRef: row.stack_user_ref,
          domains: [],
          wordpressCount: 0
        };
      }
      acc[row.stack_user_id].domains.push(row.domain_name);
      if (row.is_wordpress) {
        acc[row.stack_user_id].wordpressCount++;
      }
      return acc;
    }, {});

    res.json({
      stackUsers: Object.values(grouped),
      total: Object.keys(grouped).length
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
