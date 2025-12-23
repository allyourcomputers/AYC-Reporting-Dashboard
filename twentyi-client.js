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
 * Uses base64-encoded API key as Bearer token
 */
async function get20iToken() {
  // Return cached token if still valid
  if (tokenCache.token && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const apiKey = process.env.TWENTYI_API_KEY;

  if (!apiKey) {
    throw new Error('20i API credentials not configured in environment variables');
  }

  // 20i API requires base64-encoded API key as Bearer token
  tokenCache.token = Buffer.from(apiKey).toString('base64');
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
    return dataCache.domains;
  }

  try {
    // Fetch domains and packages in parallel
    const [domainsResponse, packagesResponse] = await Promise.all([
      twentyiRequest('/reseller/domains').catch(err => {
        logger.error('20i: Failed to fetch domains', { error: err.message });
        return [];
      }),
      twentyiRequest('/reseller/packages').catch(err => {
        logger.error('20i: Failed to fetch packages', { error: err.message });
        return [];
      })
    ]);

    const domains = Array.isArray(domainsResponse) ? domainsResponse : [];
    const packages = Array.isArray(packagesResponse) ? packagesResponse : [];

    // Build package lookup map by domain name for O(1) access
    const packageByDomainName = new Map();
    packages.forEach(pkg => {
      // Packages have a 'names' array containing domain names
      if (pkg.names && Array.isArray(pkg.names)) {
        pkg.names.forEach(domainName => {
          packageByDomainName.set(domainName, pkg);
        });
      }
    });

    // Transform and enrich domains with hosting status
    const enrichedDomains = domains.map(domain => {
      const domainName = domain.name;
      const expiryDate = new Date(domain.expiryDate);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

      // Determine status based on days until expiry
      let status = 'active';
      if (daysUntilExpiry < 0) {
        status = 'expired';
      } else if (daysUntilExpiry <= 30) {
        status = 'expiring-soon';
      }

      // Check for hosting package by domain name
      const hostingPackage = packageByDomainName.get(domainName);

      // Extract stack users from package
      let stackcpUsers = [];
      if (hostingPackage && hostingPackage.stackUsers && Array.isArray(hostingPackage.stackUsers)) {
        // Stack users are in format "stack-user:3205128"
        stackcpUsers = hostingPackage.stackUsers.map(su => {
          const match = su.match(/stack-user:(\d+)/);
          return match ? match[1] : su;
        });
      }

      return {
        id: domain.id,
        name: domainName,
        expiryDate: expiryDate.toISOString(),
        daysUntilExpiry,
        status,
        hasHosting: !!hostingPackage,
        hostingPackageId: hostingPackage?.id || null,
        hostingPackageName: hostingPackage?.packageTypeName || null,
        stackcpUsers: stackcpUsers // Array of stack user IDs
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

    logger.info('20i: Fetched domain data', {
      total: summary.totalDomains,
      withHosting: summary.domainsWithHosting,
      expiring: summary.domainsExpiringSoon
    });

    return result;
  } catch (error) {
    logger.error('20i: Failed to fetch domain data', { error: error.message });
    throw new Error('Failed to fetch domain data from 20i');
  }
}

/**
 * Get available StackCP users (for admin mapping UI)
 *
 * Returns list of StackCP users extracted from packages
 */
async function getStackcpUsers() {
  try {
    // Fetch all packages to extract stack users
    const packagesResponse = await twentyiRequest('/reseller/packages');
    const packages = Array.isArray(packagesResponse) ? packagesResponse : [];

    // Extract unique stack user IDs from all packages
    const stackUserMap = new Map();
    packages.forEach(pkg => {
      if (pkg.stackUsers && Array.isArray(pkg.stackUsers)) {
        pkg.stackUsers.forEach(stackUser => {
          // Stack users are in format "stack-user:3205128"
          const match = stackUser.match(/stack-user:(\d+)/);
          if (match) {
            const userId = match[1];
            // Use package name as a reference for the user
            if (!stackUserMap.has(userId)) {
              stackUserMap.set(userId, {
                id: userId,
                name: `Stack User ${userId}`,
                packages: []
              });
            }
            stackUserMap.get(userId).packages.push(pkg.name);
          }
        });
      }
    });

    // Convert map to array and enrich user names with package info
    const users = Array.from(stackUserMap.values()).map(user => ({
      id: user.id,
      name: `Stack User ${user.id} (${user.packages.length} package${user.packages.length !== 1 ? 's' : ''})`
    }));

    logger.info('20i: Fetched StackCP users', { count: users.length });

    return users;
  } catch (error) {
    logger.error('20i: Failed to fetch StackCP users', { error: error.message });
    throw new Error('Failed to fetch StackCP users from 20i');
  }
}

module.exports = {
  getDomains,
  getStackcpUsers
};
