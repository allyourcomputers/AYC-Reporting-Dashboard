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
 * GET /api/admin/companies
 * List all companies with their mappings
 */
router.get('/', requireSuperAdmin, async (req, res) => {
  try {
    // Get all companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .order('name', { ascending: true });

    if (companiesError) {
      logger.error('Failed to fetch companies', { error: companiesError });
      return res.status(500).json({ error: 'Failed to fetch companies' });
    }

    // Get HaloPSA client mappings
    const { data: haloPSAMappings, error: haloError } = await supabase
      .from('company_halopsa_clients')
      .select(`
        company_id,
        halopsa_client_id,
        clients (
          id,
          name
        )
      `);

    if (haloError) {
      logger.error('Failed to fetch HaloPSA mappings', { error: haloError });
      return res.status(500).json({ error: 'Failed to fetch HaloPSA mappings' });
    }

    // Get NinjaOne org mappings
    const { data: ninjaOneMappings, error: ninjaError } = await supabase
      .from('company_ninjaone_orgs')
      .select('*');

    if (ninjaError) {
      logger.error('Failed to fetch NinjaOne mappings', { error: ninjaError });
      return res.status(500).json({ error: 'Failed to fetch NinjaOne mappings' });
    }

    // Build response with mappings
    const companiesWithMappings = companies.map(company => {
      const haloPSAClients = haloPSAMappings
        .filter(m => m.company_id === company.id)
        .map(m => ({
          id: m.halopsa_client_id,
          name: m.clients?.name || 'Unknown'
        }));

      const ninjaOneOrgs = ninjaOneMappings
        .filter(m => m.company_id === company.id)
        .map(m => ({
          id: m.ninjaone_org_id,
          name: m.ninjaone_org_name
        }));

      return {
        id: company.id,
        name: company.name,
        logoUrl: company.logo_url,
        haloPSAClients,
        ninjaOneOrgs,
        createdAt: company.created_at,
        updatedAt: company.updated_at
      };
    });

    res.json({ companies: companiesWithMappings });
  } catch (error) {
    logger.error('Error fetching companies', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/companies/available-clients
 * Get all available HaloPSA clients for mapping
 */
router.get('/available-clients', requireSuperAdmin, async (req, res) => {
  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to fetch available clients', { error });
      return res.status(500).json({ error: 'Failed to fetch clients' });
    }

    res.json({ clients });
  } catch (error) {
    logger.error('Error fetching available clients', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/companies
 * Create a new company
 *
 * Body:
 * {
 *   name: string,
 *   logoUrl?: string
 * }
 */
router.post('/', requireSuperAdmin, async (req, res) => {
  try {
    const { name, logoUrl } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const { data: company, error } = await supabase
      .from('companies')
      .insert({
        name,
        logo_url: logoUrl || null
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create company', { error, name });
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Company name already exists' });
      }
      return res.status(500).json({ error: 'Failed to create company' });
    }

    logger.info('Company created successfully', { companyId: company.id, name });

    res.status(201).json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        logoUrl: company.logo_url
      }
    });
  } catch (error) {
    logger.error('Error creating company', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/companies/:companyId
 * Update a company
 *
 * Body:
 * {
 *   name?: string,
 *   logoUrl?: string
 * }
 */
router.put('/:companyId', requireSuperAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, logoUrl } = req.body;

    // Verify company exists
    const { data: existing, error: fetchError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Build update object
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (logoUrl !== undefined) updates.logo_url = logoUrl;

    const { error: updateError } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', companyId);

    if (updateError) {
      logger.error('Failed to update company', { error: updateError, companyId });
      if (updateError.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Company name already exists' });
      }
      return res.status(500).json({ error: 'Failed to update company' });
    }

    logger.info('Company updated successfully', { companyId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating company', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/companies/:companyId/halopsa-clients
 * Set HaloPSA client mappings for a company (replaces existing)
 *
 * Body:
 * {
 *   clientIds: number[] (HaloPSA client IDs)
 * }
 */
router.post('/:companyId/halopsa-clients', requireSuperAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { clientIds } = req.body;

    if (!Array.isArray(clientIds)) {
      return res.status(400).json({ error: 'clientIds must be an array' });
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Delete existing mappings
    const { error: deleteError } = await supabase
      .from('company_halopsa_clients')
      .delete()
      .eq('company_id', companyId);

    if (deleteError) {
      logger.error('Failed to delete existing HaloPSA mappings', { error: deleteError, companyId });
      return res.status(500).json({ error: 'Failed to update mappings' });
    }

    // Create new mappings
    if (clientIds.length > 0) {
      const mappings = clientIds.map(clientId => ({
        company_id: companyId,
        halopsa_client_id: clientId
      }));

      const { error: insertError } = await supabase
        .from('company_halopsa_clients')
        .insert(mappings);

      if (insertError) {
        logger.error('Failed to create HaloPSA mappings', { error: insertError, companyId });
        return res.status(500).json({ error: 'Failed to create mappings' });
      }
    }

    logger.info('HaloPSA mappings updated', { companyId, count: clientIds.length });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating HaloPSA mappings', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/companies/:companyId/ninjaone-orgs
 * Set NinjaOne organization mappings for a company (replaces existing)
 *
 * Body:
 * {
 *   organizations: [{ id: number, name: string }]
 * }
 */
router.post('/:companyId/ninjaone-orgs', requireSuperAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { organizations } = req.body;

    if (!Array.isArray(organizations)) {
      return res.status(400).json({ error: 'organizations must be an array' });
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Delete existing mappings
    const { error: deleteError } = await supabase
      .from('company_ninjaone_orgs')
      .delete()
      .eq('company_id', companyId);

    if (deleteError) {
      logger.error('Failed to delete existing NinjaOne mappings', { error: deleteError, companyId });
      return res.status(500).json({ error: 'Failed to update mappings' });
    }

    // Create new mappings
    if (organizations.length > 0) {
      const mappings = organizations.map(org => ({
        company_id: companyId,
        ninjaone_org_id: org.id,
        ninjaone_org_name: org.name
      }));

      const { error: insertError } = await supabase
        .from('company_ninjaone_orgs')
        .insert(mappings);

      if (insertError) {
        logger.error('Failed to create NinjaOne mappings', { error: insertError, companyId });
        return res.status(500).json({ error: 'Failed to create mappings' });
      }
    }

    logger.info('NinjaOne mappings updated', { companyId, count: organizations.length });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating NinjaOne mappings', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/companies/:companyId
 * Delete a company and all associated mappings
 */
router.delete('/:companyId', requireSuperAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Verify company exists
    const { data: company, error: fetchError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .single();

    if (fetchError || !company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if any users are assigned to this company
    const { data: userCompanies, error: userCheckError } = await supabase
      .from('user_companies')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);

    if (userCheckError) {
      logger.error('Failed to check user assignments', { error: userCheckError, companyId });
      return res.status(500).json({ error: 'Failed to verify company can be deleted' });
    }

    if (userCompanies && userCompanies.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete company with assigned users. Remove user assignments first.'
      });
    }

    // Delete company (cascades to mappings via foreign keys)
    const { error: deleteError } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId);

    if (deleteError) {
      logger.error('Failed to delete company', { error: deleteError, companyId });
      return res.status(500).json({ error: 'Failed to delete company' });
    }

    logger.info('Company deleted successfully', { companyId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting company', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
