const axios = require('axios');
const logger = require('./logger');

// Token cache
let tokenCache = {
  token: null,
  expiresAt: null
};

// Data cache (5 minutes TTL)
let dataCache = {
  domains: null,
  timestamp: null,
  TTL: 5 * 60 * 1000 // 5 minutes
};

/**
 * Get authentication token for 20i API
 *
 * NOTE: 20i API authentication method needs verification
 * TODO: Verify if 20i uses Bearer token, API key, or OAuth2
 * Current implementation assumes Bearer token with API key
 */
async function get20iToken() {
  // Return cached token if still valid
  if (tokenCache.token && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
    logger.info('Using cached 20i token');
    return tokenCache.token;
  }

  const apiKey = process.env.TWENTYI_API_KEY;
  const oauthKey = process.env.TWENTYI_OAUTH_KEY;

  if (!apiKey) {
    throw new Error('20i API credentials not configured in environment variables');
  }

  logger.info('Configuring 20i API authentication');

  // TODO: Verify 20i authentication method
  // For now, use API key directly as Bearer token
  tokenCache.token = apiKey;
  tokenCache.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

  return tokenCache.token;
}

/**
 * Make authenticated request to 20i API
 *
 * @param {string} endpoint - API endpoint path (e.g., '/reseller/domains')
 * @param {object} params - Query parameters
 * @returns {Promise<any>} API response data
 */
async function twentyiRequest(endpoint, params = {}) {
  const token = await get20iToken();

  // TODO: Verify correct base URL for 20i API
  const baseUrl = 'https://api.20i.com';

  try {
    const response = await axios.get(`${baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      params,
      timeout: 30000 // 30 second timeout
    });

    return response.data;
  } catch (error) {
    logger.error(`20i API request failed: ${endpoint}`, {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

/**
 * Check if data cache is still valid
 */
function isCacheValid() {
  return dataCache.domains &&
         dataCache.timestamp &&
         (Date.now() - dataCache.timestamp) < dataCache.TTL;
}

/**
 * Get all domains with hosting status
 *
 * Returns domains with expiry dates and hosting package information
 * Data is cached for 5 minutes to reduce API calls
 */
async function getDomains() {
  // Return cached data if valid
  if (isCacheValid()) {
    logger.info('Returning cached 20i domain data');
    return dataCache.domains;
  }

  logger.info('Fetching fresh 20i domain data');

  try {
    // TODO: Verify correct endpoints for domains and packages
    // These endpoints need to be confirmed with 20i API documentation
    const [domainsResponse, packagesResponse] = await Promise.all([
      twentyiRequest('/reseller/domains').catch(err => {
        logger.error('Failed to fetch domains', { error: err.message });
        return { result: [] };
      }),
      twentyiRequest('/reseller/packages').catch(err => {
        logger.error('Failed to fetch packages', { error: err.message });
        return { result: [] };
      })
    ]);

    // TODO: Adjust based on actual API response structure
    // These property names may need to be changed
    const domains = domainsResponse.result || domainsResponse.domains || [];
    const packages = packagesResponse.result || packagesResponse.packages || [];

    logger.info('Fetched 20i data', {
      domainsCount: domains.length,
      packagesCount: packages.length
    });

    // Build package lookup map for O(1) access
    const packageMap = new Map();
    packages.forEach(pkg => {
      // TODO: Verify correct ID field name
      const pkgId = pkg.id || pkg.package_id || pkg.packageId;
      packageMap.set(pkgId, pkg);
    });

    // Transform and enrich domains with hosting status
    const enrichedDomains = domains.map(domain => {
      // TODO: Adjust field names based on actual API response
      const domainId = domain.id || domain.domain_id;
      const domainName = domain.name || domain.domain_name || domain.domain;
      const expiryDateRaw = domain.expiry_date || domain.expiryDate || domain.expires;
      const packageId = domain.package_id || domain.packageId;
      const stackcpUserId = domain.stackcp_user_id || domain.user_id || domain.userId;

      // Parse expiry date
      const expiryDate = new Date(expiryDateRaw);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

      // Determine status based on days until expiry
      let status = 'active';
      if (daysUntilExpiry < 0) {
        status = 'expired';
      } else if (daysUntilExpiry <= 30) {
        status = 'expiring-soon';
      }

      // Check for hosting package
      const hostingPackage = packageMap.get(packageId);

      return {
        id: domainId,
        name: domainName,
        expiryDate: expiryDate.toISOString(),
        daysUntilExpiry,
        status,
        hasHosting: !!hostingPackage,
        hostingPackageId: hostingPackage?.id || null,
        hostingPackageName: hostingPackage?.name || null,
        stackcpUserId: stackcpUserId
      };
    });

    // Calculate summary statistics
    const summary = {
      totalDomains: enrichedDomains.length,
      domainsWithHosting: enrichedDomains.filter(d => d.hasHosting).length,
      domainsExpiringSoon: enrichedDomains.filter(d =>
        d.status === 'expiring-soon' || d.status === 'expired'
      ).length
    };

    const result = {
      summary,
      domains: enrichedDomains,
      lastUpdated: new Date().toISOString()
    };

    // Cache result
    dataCache.domains = result;
    dataCache.timestamp = Date.now();

    logger.info('Successfully fetched and cached 20i domain data', {
      total: summary.totalDomains,
      withHosting: summary.domainsWithHosting,
      expiringSoon: summary.domainsExpiringSoon
    });

    return result;
  } catch (error) {
    logger.error('Failed to fetch 20i domain data', { error: error.message });
    throw new Error('Failed to fetch domain data from 20i');
  }
}

/**
 * Get available StackCP users (for admin mapping UI)
 *
 * Returns list of StackCP users that can be mapped to companies
 */
async function getStackcpUsers() {
  logger.info('Fetching 20i StackCP users');

  try {
    // TODO: Verify correct endpoint for listing StackCP users
    const response = await twentyiRequest('/reseller/users');

    // TODO: Adjust based on actual API response structure
    const users = response.result || response.users || [];

    logger.info(`Found ${users.length} 20i StackCP users`);

    return users.map(user => ({
      // TODO: Adjust field names based on actual API response
      id: (user.id || user.user_id || user.userId)?.toString(),
      name: user.name || user.username || user.email || user.id?.toString()
    }));
  } catch (error) {
    logger.error('Failed to fetch StackCP users', { error: error.message });
    throw new Error('Failed to fetch StackCP users from 20i');
  }
}

module.exports = {
  getDomains,
  getStackcpUsers
};
