const axios = require('axios');
const logger = require('./logger');

// Token cache
let tokenCache = {
  token: null,
  expiresAt: null
};

// Data cache (5 minutes TTL)
let dataCache = {
  data: null,
  timestamp: null,
  TTL: 5 * 60 * 1000 // 5 minutes
};

/**
 * Get OAuth2 access token from NinjaOne
 */
async function getNinjaOneToken() {
  // Return cached token if still valid
  if (tokenCache.token && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
    logger.info('Using cached NinjaOne token');
    return tokenCache.token;
  }

  const clientId = process.env.NINJA_CLIENT_ID;
  const clientSecret = process.env.NINJA_CLIENT_SECRET;
  const baseUrl = process.env.NINJA_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error('NinjaOne credentials not configured in environment variables');
  }

  try {
    logger.info('Requesting new NinjaOne OAuth token');

    const response = await axios.post(
      `${baseUrl}/ws/oauth/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'monitoring management control'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, expires_in } = response.data;

    // Cache token with 5-minute buffer before expiry
    tokenCache.token = access_token;
    tokenCache.expiresAt = Date.now() + ((expires_in - 300) * 1000);

    logger.info('Successfully obtained NinjaOne token', { expiresIn: expires_in });
    return access_token;
  } catch (error) {
    logger.error('Failed to get NinjaOne token', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw new Error('Failed to authenticate with NinjaOne');
  }
}

/**
 * Make authenticated request to NinjaOne API
 */
async function ninjaRequest(endpoint, params = {}) {
  const token = await getNinjaOneToken();
  const baseUrl = process.env.NINJA_BASE_URL;

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
    logger.error(`NinjaOne API request failed: ${endpoint}`, {
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
  return dataCache.data &&
         dataCache.timestamp &&
         (Date.now() - dataCache.timestamp) < dataCache.TTL;
}

/**
 * Get all servers with health and patch information
 */
async function getServers() {
  // Return cached data if valid
  if (isCacheValid()) {
    logger.info('Returning cached server data');
    return dataCache.data;
  }

  logger.info('Fetching fresh server data from NinjaOne');

  try {
    // Fetch devices and organizations in parallel
    const [allDevices, organizations] = await Promise.all([
      ninjaRequest('/v2/devices'),
      ninjaRequest('/v2/organizations').catch(err => {
        logger.error('Failed to fetch organizations', { error: err.message });
        return [];
      })
    ]);

    logger.info(`Found ${allDevices.length} total devices`);

    // Filter for servers (Windows Server or Linux Server in node class/role)
    const devices = allDevices.filter(device => {
      const nodeClass = (device.nodeClass || '').toLowerCase();
      const nodeRole = (device.nodeRolePolicyName || device.roleName || '').toLowerCase();

      return nodeClass.includes('server') ||
             nodeRole.includes('server') ||
             nodeClass.includes('windows server') ||
             nodeClass.includes('linux server');
    });

    logger.info(`Found ${devices.length} servers after filtering`);

    // Create organization lookup map
    const orgMap = new Map();
    if (Array.isArray(organizations)) {
      organizations.forEach(org => {
        orgMap.set(org.id, org.name);
      });
    }

    if (!devices || devices.length === 0) {
      const emptyResult = {
        summary: {
          totalServers: 0,
          onlineServers: 0,
          offlineServers: 0,
          serversNeedingPatches: 0
        },
        servers: [],
        lastUpdated: new Date().toISOString()
      };

      // Cache empty result
      dataCache.data = emptyResult;
      dataCache.timestamp = Date.now();

      return emptyResult;
    }

    // Get device IDs for queries
    const deviceIds = devices.map(d => d.id);

    // Fetch additional data in parallel
    const [osData, computerSystemsData, osPatchData, softwarePatchData] = await Promise.all([
      ninjaRequest('/v2/queries/operating-systems').catch(err => {
        logger.error('Failed to fetch OS data', { error: err.message });
        return { results: [] };
      }),
      ninjaRequest('/v2/queries/computer-systems').catch(err => {
        logger.error('Failed to fetch computer systems data', { error: err.message });
        return { results: [] };
      }),
      ninjaRequest('/v2/queries/os-patches').catch(err => {
        logger.error('Failed to fetch OS patch data', { error: err.message });
        return { results: [] };
      }),
      ninjaRequest('/v2/queries/software-patches').catch(err => {
        logger.error('Failed to fetch software patch data', { error: err.message });
        return { results: [] };
      })
    ]);

    // Extract results arrays (queries return {results: [...]} format)
    const osResults = Array.isArray(osData) ? osData : (osData.results || []);
    const computerSystemsResults = Array.isArray(computerSystemsData) ? computerSystemsData : (computerSystemsData.results || []);
    const osPatchResults = Array.isArray(osPatchData) ? osPatchData : (osPatchData.results || []);
    const softwarePatchResults = Array.isArray(softwarePatchData) ? softwarePatchData : (softwarePatchData.results || []);

    // Create lookup maps
    const osMap = new Map();
    osResults.forEach(os => {
      osMap.set(os.deviceId, os);
    });

    const computerSystemsMap = new Map();
    computerSystemsResults.forEach(cs => {
      computerSystemsMap.set(cs.deviceId, cs);
    });

    const osPatchMap = new Map();
    osPatchResults.forEach(patch => {
      if (!osPatchMap.has(patch.deviceId)) {
        osPatchMap.set(patch.deviceId, []);
      }
      osPatchMap.get(patch.deviceId).push(patch);
    });

    const softwarePatchMap = new Map();
    softwarePatchResults.forEach(patch => {
      if (!softwarePatchMap.has(patch.deviceId)) {
        softwarePatchMap.set(patch.deviceId, []);
      }
      softwarePatchMap.get(patch.deviceId).push(patch);
    });

    // Transform and enrich device data
    const servers = devices.map(device => {
      const os = osMap.get(device.id);
      const computerSystem = computerSystemsMap.get(device.id);
      const osPatches = osPatchMap.get(device.id) || [];
      const softwarePatches = softwarePatchMap.get(device.id) || [];

      // Count pending patches (status !== 'INSTALLED')
      const osPending = osPatches.filter(p => p.status !== 'INSTALLED').length;
      const softwarePending = softwarePatches.filter(p => p.status !== 'INSTALLED').length;

      // Calculate uptime in days from computer system data
      let uptime = null;
      if (computerSystem?.bootTime) {
        const bootTime = typeof computerSystem.bootTime === 'number'
          ? new Date(computerSystem.bootTime * 1000)
          : new Date(computerSystem.bootTime);
        uptime = (Date.now() - bootTime.getTime()) / (1000 * 60 * 60 * 24);
      } else if (computerSystem?.lastBootTime) {
        const bootTime = typeof computerSystem.lastBootTime === 'number'
          ? new Date(computerSystem.lastBootTime * 1000)
          : new Date(computerSystem.lastBootTime);
        uptime = (Date.now() - bootTime.getTime()) / (1000 * 60 * 60 * 24);
      } else if (device.lastRebootTime) {
        const rebootTime = typeof device.lastRebootTime === 'number'
          ? new Date(device.lastRebootTime * 1000)
          : new Date(device.lastRebootTime);
        uptime = (Date.now() - rebootTime.getTime()) / (1000 * 60 * 60 * 24);
      }

      // Convert Unix timestamp to ISO string
      let lastContactISO = null;
      if (device.lastContact) {
        const timestamp = device.lastContact * 1000; // Convert to milliseconds
        lastContactISO = new Date(timestamp).toISOString();
      }

      // Determine OS type for icon
      const osName = (os?.name || device.nodeClass || '').toLowerCase();
      let osType = 'unknown';
      if (osName.includes('windows')) {
        osType = 'windows';
      } else if (osName.includes('linux') || osName.includes('ubuntu') || osName.includes('centos') || osName.includes('debian')) {
        osType = 'linux';
      }

      return {
        id: device.id,
        name: device.systemName || device.dnsName || 'Unknown',
        clientName: orgMap.get(device.organizationId) || 'Unknown Client',
        status: device.offline === false ? 'ONLINE' : 'OFFLINE',
        lastContact: lastContactISO,
        uptime: uptime ? uptime.toFixed(1) : null,
        os: {
          name: os?.name || device.nodeClass || 'Unknown',
          version: os?.version || '',
          type: osType
        },
        patches: {
          osPending,
          softwarePending,
          lastScan: device.lastPatchManagementRun || null
        }
      };
    });

    // Calculate summary statistics
    const onlineServers = servers.filter(s => s.status === 'ONLINE').length;
    const offlineServers = servers.filter(s => s.status === 'OFFLINE').length;
    const serversNeedingPatches = servers.filter(s =>
      s.patches.osPending > 0 || s.patches.softwarePending > 0
    ).length;

    const result = {
      summary: {
        totalServers: servers.length,
        onlineServers,
        offlineServers,
        serversNeedingPatches
      },
      servers,
      lastUpdated: new Date().toISOString()
    };

    // Cache the result
    dataCache.data = result;
    dataCache.timestamp = Date.now();

    logger.info('Successfully fetched and cached server data', {
      total: result.summary.totalServers,
      online: result.summary.onlineServers,
      needingPatches: result.summary.serversNeedingPatches
    });

    return result;
  } catch (error) {
    logger.error('Failed to fetch server data', { error: error.message });
    throw new Error('Failed to fetch server data from NinjaOne');
  }
}

/**
 * Get detailed information for a specific server
 */
async function getServerDetails(deviceId) {
  logger.info(`Fetching details for server ${deviceId}`);

  try {
    const [device, osData, computerSystemsData, osPatchData, softwarePatchData, dashboardUrl, organizations] = await Promise.all([
      ninjaRequest(`/v2/device/${deviceId}`),
      ninjaRequest('/v2/queries/operating-systems').catch(() => ({ results: [] })),
      ninjaRequest('/v2/queries/computer-systems').catch(() => ({ results: [] })),
      ninjaRequest('/v2/queries/os-patches').catch(() => ({ results: [] })),
      ninjaRequest('/v2/queries/software-patches').catch(() => ({ results: [] })),
      ninjaRequest(`/v2/device/${deviceId}/dashboard-url`).catch(() => ({ url: null })),
      ninjaRequest('/v2/organizations').catch(() => [])
    ]);

    // Extract results
    const osResults = Array.isArray(osData) ? osData : (osData?.results || []);
    const computerSystemsResults = Array.isArray(computerSystemsData) ? computerSystemsData : (computerSystemsData?.results || []);
    const osPatchResults = Array.isArray(osPatchData) ? osPatchData : (osPatchData?.results || []);
    const softwarePatchResults = Array.isArray(softwarePatchData) ? softwarePatchData : (softwarePatchData?.results || []);

    // Filter for this specific device
    const os = osResults.find(o => o.deviceId === parseInt(deviceId));
    const computerSystem = computerSystemsResults.find(c => c.deviceId === parseInt(deviceId));
    const osPatches = osPatchResults.filter(p => p.deviceId === parseInt(deviceId));
    const softwarePatches = softwarePatchResults.filter(p => p.deviceId === parseInt(deviceId));

    const osPending = osPatches.filter(p => p.status !== 'INSTALLED');
    const softwarePending = softwarePatches.filter(p => p.status !== 'INSTALLED');

    // Log patch data for debugging
    logger.info(`Patch data for device ${deviceId}:`, {
      totalOsPatches: osPatches.length,
      totalSoftwarePatches: softwarePatches.length,
      osPendingCount: osPending.length,
      softwarePendingCount: softwarePending.length,
      sampleOsPatch: osPatches[0] ? Object.keys(osPatches[0]) : [],
      sampleSoftwarePatch: softwarePatches[0] ? Object.keys(softwarePatches[0]) : []
    });

    // Log device and computer system fields for debugging
    logger.info(`Device ${deviceId} fields:`, {
      deviceFields: Object.keys(device),
      computerSystemFields: computerSystem ? Object.keys(computerSystem) : [],
      hasComputerSystem: !!computerSystem,
      osFields: os ? Object.keys(os) : [],
      deviceSystemFields: device.system ? Object.keys(device.system) : [],
      deviceOsFields: device.os ? Object.keys(device.os) : [],
      // Check for any boot-related fields
      deviceLastRebootTime: device.lastRebootTime,
      osBootTime: os?.bootTime,
      osLastBootTime: os?.lastBootTime,
      osUptime: os?.uptime,
      deviceSystemUptime: device.system?.uptime,
      computerSystemTimestamp: computerSystem?.timestamp
    });

    // Calculate uptime from computer system data
    let uptime = null;
    if (computerSystem?.bootTime) {
      // bootTime is likely a Unix timestamp
      const bootTime = typeof computerSystem.bootTime === 'number'
        ? new Date(computerSystem.bootTime * 1000)
        : new Date(computerSystem.bootTime);
      uptime = (Date.now() - bootTime.getTime()) / (1000 * 60 * 60 * 24);
      logger.info(`Calculated uptime from bootTime: ${uptime} days`);
    } else if (computerSystem?.lastBootTime) {
      const bootTime = typeof computerSystem.lastBootTime === 'number'
        ? new Date(computerSystem.lastBootTime * 1000)
        : new Date(computerSystem.lastBootTime);
      uptime = (Date.now() - bootTime.getTime()) / (1000 * 60 * 60 * 24);
      logger.info(`Calculated uptime from lastBootTime: ${uptime} days`);
    } else if (device.lastRebootTime) {
      const rebootTime = typeof device.lastRebootTime === 'number'
        ? new Date(device.lastRebootTime * 1000)
        : new Date(device.lastRebootTime);
      uptime = (Date.now() - rebootTime.getTime()) / (1000 * 60 * 60 * 24);
      logger.info(`Calculated uptime from device.lastRebootTime: ${uptime} days`);
    }

    // Convert Unix timestamp to ISO string
    let lastContactISO = null;
    if (device.lastContact) {
      const timestamp = device.lastContact * 1000; // Convert to milliseconds
      lastContactISO = new Date(timestamp).toISOString();
    }

    // Get organization name
    const orgMap = new Map();
    if (Array.isArray(organizations)) {
      organizations.forEach(org => {
        orgMap.set(org.id, org.name);
      });
    }

    // Determine OS type for icon
    const osName = (os?.name || device.nodeClass || '').toLowerCase();
    let osType = 'unknown';
    if (osName.includes('windows')) {
      osType = 'windows';
    } else if (osName.includes('linux') || osName.includes('ubuntu') || osName.includes('centos') || osName.includes('debian')) {
      osType = 'linux';
    }

    return {
      id: device.id,
      name: device.systemName || device.dnsName || 'Unknown',
      clientName: orgMap.get(device.organizationId) || 'Unknown Client',
      status: device.offline === false ? 'ONLINE' : 'OFFLINE',
      lastContact: lastContactISO,
      uptime: uptime ? uptime.toFixed(1) : null,
      os: {
        name: os?.name || device.nodeClass || 'Unknown',
        version: os?.version || '',
        type: osType
      },
      patches: {
        osPending: osPending.length,
        softwarePending: softwarePending.length,
        osPendingList: osPending,
        softwarePendingList: softwarePending,
        lastScan: device.lastPatchManagementRun || null
      },
      details: {
        manufacturer: device.system?.manufacturer,
        model: device.system?.model,
        serialNumber: device.system?.serialNumber,
        biosVersion: device.system?.biosVersion
      },
      ninjaoneUrl: dashboardUrl?.url || null
    };
  } catch (error) {
    logger.error(`Failed to fetch server details for ${deviceId}`, { error: error.message });
    throw new Error('Failed to fetch server details from NinjaOne');
  }
}

module.exports = {
  getServers,
  getServerDetails
};
