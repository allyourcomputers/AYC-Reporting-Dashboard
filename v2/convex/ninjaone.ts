import { action } from "./_generated/server";
import { v } from "convex/values";

// Types for NinjaOne API responses
interface NinjaDevice {
  id: number;
  systemName?: string;
  dnsName?: string;
  organizationId: number;
  nodeClass?: string;
  nodeRolePolicyName?: string;
  roleName?: string;
  offline?: boolean;
  lastContact?: number;
  lastPatchManagementRun?: string;
  os?: {
    lastBootTime?: number;
  };
  system?: {
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    biosVersion?: string;
  };
}

interface NinjaOrganization {
  id: number;
  name: string;
}

interface NinjaOSData {
  deviceId: number;
  name?: string;
  version?: string;
  lastBootTime?: number;
}

interface NinjaComputerSystem {
  deviceId: number;
  bootTime?: number;
}

interface NinjaPatch {
  deviceId: number;
  status: string;
  name?: string;
  kb?: string;
  severity?: string;
}

interface NinjaQueryResponse<T> {
  results?: T[];
}

interface DeviceInfo {
  id: number;
  name: string;
  organizationId: number;
  clientName: string;
  status: "ONLINE" | "OFFLINE";
  lastContact: string | null;
  uptime: string | null;
  os: {
    name: string;
    version: string;
    type: "windows" | "linux" | "mac" | "unknown";
  };
  patches: {
    osPending: number;
    softwarePending: number;
    lastScan: string | null;
  };
}

interface DeviceDetails extends DeviceInfo {
  patches: {
    osPending: number;
    softwarePending: number;
    osPendingList: NinjaPatch[];
    softwarePendingList: NinjaPatch[];
    lastScan: string | null;
  };
  details: {
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    biosVersion?: string;
  };
  ninjaoneUrl: string | null;
}

interface ServerResult {
  summary: {
    totalServers: number;
    onlineServers: number;
    offlineServers: number;
    serversNeedingPatches: number;
  };
  servers: DeviceInfo[];
  lastUpdated: string;
}

interface WorkstationResult {
  summary: {
    totalWorkstations: number;
    onlineWorkstations: number;
    offlineWorkstations: number;
    workstationsNeedingPatches: number;
  };
  workstations: DeviceInfo[];
  lastUpdated: string;
}

/**
 * Get OAuth2 access token from NinjaOne
 * Note: Token caching won't persist between Convex action invocations,
 * so we fetch a fresh token each time
 */
async function getNinjaOneToken(): Promise<string> {
  const clientId = process.env.NINJA_CLIENT_ID;
  const clientSecret = process.env.NINJA_CLIENT_SECRET;
  const baseUrl = process.env.NINJA_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error("NinjaOne credentials not configured in environment variables");
  }

  try {
    const response = await fetch(`${baseUrl}/ws/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "monitoring management control",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("NinjaOne token request failed", {
        status: response.status,
        error: errorText,
      });
      throw new Error("Failed to authenticate with NinjaOne");
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to get NinjaOne token", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Failed to authenticate with NinjaOne");
  }
}

/**
 * Make authenticated request to NinjaOne API
 */
async function ninjaRequest<T>(endpoint: string, token: string): Promise<T> {
  const baseUrl = process.env.NINJA_BASE_URL;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`NinjaOne API request failed: ${endpoint}`, {
        status: response.status,
        error: errorText,
      });
      throw new Error(`NinjaOne API request failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`NinjaOne API request timed out: ${endpoint}`);
    }
    console.error(`NinjaOne API request failed: ${endpoint}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Helper function to extract results from NinjaOne query responses
 */
function extractResults<T>(data: T[] | NinjaQueryResponse<T>): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  return data.results || [];
}

/**
 * Helper function to calculate uptime in days
 */
function calculateUptime(
  os: NinjaOSData | undefined,
  device: NinjaDevice,
  computerSystem: NinjaComputerSystem | undefined
): string | null {
  let bootTime: number | undefined;

  if (os?.lastBootTime) {
    bootTime = os.lastBootTime;
  } else if (device.os?.lastBootTime) {
    bootTime = device.os.lastBootTime;
  } else if (computerSystem?.bootTime) {
    bootTime = computerSystem.bootTime;
  }

  if (bootTime) {
    const uptimeDays = (Date.now() - bootTime * 1000) / (1000 * 60 * 60 * 24);
    return uptimeDays.toFixed(1);
  }

  return null;
}

/**
 * Helper function to determine OS type
 */
function getOSType(osName: string, nodeClass: string, isWorkstation: boolean = false): "windows" | "linux" | "mac" | "unknown" {
  const combined = (osName || nodeClass || "").toLowerCase();

  if (combined.includes("windows")) {
    return "windows";
  } else if (combined.includes("mac") || combined.includes("darwin")) {
    return "mac";
  } else if (
    combined.includes("linux") ||
    combined.includes("ubuntu") ||
    combined.includes("centos") ||
    combined.includes("debian")
  ) {
    return "linux";
  }

  return "unknown";
}

/**
 * Helper function to convert Unix timestamp to ISO string
 */
function timestampToISO(timestamp: number | undefined): string | null {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Transform device data into standardized format
 */
function transformDevice(
  device: NinjaDevice,
  orgMap: Map<number, string>,
  osMap: Map<number, NinjaOSData>,
  computerSystemsMap: Map<number, NinjaComputerSystem>,
  osPatchMap: Map<number, NinjaPatch[]>,
  softwarePatchMap: Map<number, NinjaPatch[]>,
  isWorkstation: boolean = false
): DeviceInfo {
  const os = osMap.get(device.id);
  const computerSystem = computerSystemsMap.get(device.id);
  const osPatches = osPatchMap.get(device.id) || [];
  const softwarePatches = softwarePatchMap.get(device.id) || [];

  // Count pending patches (status !== 'INSTALLED')
  const osPending = osPatches.filter((p) => p.status !== "INSTALLED").length;
  const softwarePending = softwarePatches.filter((p) => p.status !== "INSTALLED").length;

  return {
    id: device.id,
    name: device.systemName || device.dnsName || "Unknown",
    organizationId: device.organizationId,
    clientName: orgMap.get(device.organizationId) || "Unknown Client",
    status: device.offline === false ? "ONLINE" : "OFFLINE",
    lastContact: timestampToISO(device.lastContact),
    uptime: calculateUptime(os, device, computerSystem),
    os: {
      name: os?.name || device.nodeClass || "Unknown",
      version: os?.version || "",
      type: getOSType(os?.name || "", device.nodeClass || "", isWorkstation),
    },
    patches: {
      osPending,
      softwarePending,
      lastScan: device.lastPatchManagementRun || null,
    },
  };
}

/**
 * Fetch all enrichment data in parallel
 */
async function fetchEnrichmentData(token: string): Promise<{
  osMap: Map<number, NinjaOSData>;
  computerSystemsMap: Map<number, NinjaComputerSystem>;
  osPatchMap: Map<number, NinjaPatch[]>;
  softwarePatchMap: Map<number, NinjaPatch[]>;
}> {
  const [osData, computerSystemsData, osPatchData, softwarePatchData] = await Promise.all([
    ninjaRequest<NinjaOSData[] | NinjaQueryResponse<NinjaOSData>>("/v2/queries/operating-systems", token).catch(
      (err) => {
        console.error("Failed to fetch OS data", { error: err.message });
        return { results: [] as NinjaOSData[] };
      }
    ),
    ninjaRequest<NinjaComputerSystem[] | NinjaQueryResponse<NinjaComputerSystem>>(
      "/v2/queries/computer-systems",
      token
    ).catch((err) => {
      console.error("Failed to fetch computer systems data", { error: err.message });
      return { results: [] as NinjaComputerSystem[] };
    }),
    ninjaRequest<NinjaPatch[] | NinjaQueryResponse<NinjaPatch>>("/v2/queries/os-patches", token).catch((err) => {
      console.error("Failed to fetch OS patch data", { error: err.message });
      return { results: [] as NinjaPatch[] };
    }),
    ninjaRequest<NinjaPatch[] | NinjaQueryResponse<NinjaPatch>>("/v2/queries/software-patches", token).catch((err) => {
      console.error("Failed to fetch software patch data", { error: err.message });
      return { results: [] as NinjaPatch[] };
    }),
  ]);

  // Extract results arrays
  const osResults = extractResults(osData);
  const computerSystemsResults = extractResults(computerSystemsData);
  const osPatchResults = extractResults(osPatchData);
  const softwarePatchResults = extractResults(softwarePatchData);

  // Create lookup maps
  const osMap = new Map<number, NinjaOSData>();
  osResults.forEach((os) => {
    osMap.set(os.deviceId, os);
  });

  const computerSystemsMap = new Map<number, NinjaComputerSystem>();
  computerSystemsResults.forEach((cs) => {
    computerSystemsMap.set(cs.deviceId, cs);
  });

  const osPatchMap = new Map<number, NinjaPatch[]>();
  osPatchResults.forEach((patch) => {
    if (!osPatchMap.has(patch.deviceId)) {
      osPatchMap.set(patch.deviceId, []);
    }
    osPatchMap.get(patch.deviceId)!.push(patch);
  });

  const softwarePatchMap = new Map<number, NinjaPatch[]>();
  softwarePatchResults.forEach((patch) => {
    if (!softwarePatchMap.has(patch.deviceId)) {
      softwarePatchMap.set(patch.deviceId, []);
    }
    softwarePatchMap.get(patch.deviceId)!.push(patch);
  });

  return { osMap, computerSystemsMap, osPatchMap, softwarePatchMap };
}

/**
 * Get all servers with health and patch information
 */
export const getServers = action({
  args: {},
  handler: async (): Promise<ServerResult> => {
    try {
      const token = await getNinjaOneToken();

      // Fetch devices and organizations in parallel
      const [allDevices, organizations] = await Promise.all([
        ninjaRequest<NinjaDevice[]>("/v2/devices", token),
        ninjaRequest<NinjaOrganization[]>("/v2/organizations", token).catch((err) => {
          console.error("NinjaOne: Failed to fetch organizations", { error: err.message });
          return [] as NinjaOrganization[];
        }),
      ]);

      // Filter for servers (Windows Server or Linux Server in node class/role)
      const devices = allDevices.filter((device) => {
        const nodeClass = (device.nodeClass || "").toLowerCase();
        const nodeRole = (device.nodeRolePolicyName || device.roleName || "").toLowerCase();

        return (
          nodeClass.includes("server") ||
          nodeRole.includes("server") ||
          nodeClass.includes("windows server") ||
          nodeClass.includes("linux server")
        );
      });

      // Create organization lookup map
      const orgMap = new Map<number, string>();
      if (Array.isArray(organizations)) {
        organizations.forEach((org) => {
          orgMap.set(org.id, org.name);
        });
      }

      if (!devices || devices.length === 0) {
        return {
          summary: {
            totalServers: 0,
            onlineServers: 0,
            offlineServers: 0,
            serversNeedingPatches: 0,
          },
          servers: [],
          lastUpdated: new Date().toISOString(),
        };
      }

      // Fetch enrichment data in parallel
      const { osMap, computerSystemsMap, osPatchMap, softwarePatchMap } = await fetchEnrichmentData(token);

      // Transform and enrich device data
      const servers = devices.map((device) =>
        transformDevice(device, orgMap, osMap, computerSystemsMap, osPatchMap, softwarePatchMap, false)
      );

      // Calculate summary statistics
      const onlineServers = servers.filter((s) => s.status === "ONLINE").length;
      const offlineServers = servers.filter((s) => s.status === "OFFLINE").length;
      const serversNeedingPatches = servers.filter(
        (s) => s.patches.osPending > 0 || s.patches.softwarePending > 0
      ).length;

      const result: ServerResult = {
        summary: {
          totalServers: servers.length,
          onlineServers,
          offlineServers,
          serversNeedingPatches,
        },
        servers,
        lastUpdated: new Date().toISOString(),
      };

      console.log("NinjaOne: Fetched server data", {
        total: result.summary.totalServers,
        online: result.summary.onlineServers,
        needingPatches: result.summary.serversNeedingPatches,
      });

      return result;
    } catch (error) {
      console.error("NinjaOne: Failed to fetch server data", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Failed to fetch server data from NinjaOne");
    }
  },
});

/**
 * Get detailed information for a specific server
 */
export const getServerDetails = action({
  args: {
    deviceId: v.number(),
  },
  handler: async (_, { deviceId }): Promise<DeviceDetails> => {
    try {
      const token = await getNinjaOneToken();

      const [device, osData, computerSystemsData, osPatchData, softwarePatchData, dashboardUrl, organizations] =
        await Promise.all([
          ninjaRequest<NinjaDevice>(`/v2/device/${deviceId}`, token),
          ninjaRequest<NinjaOSData[] | NinjaQueryResponse<NinjaOSData>>("/v2/queries/operating-systems", token).catch(
            () => ({ results: [] as NinjaOSData[] })
          ),
          ninjaRequest<NinjaComputerSystem[] | NinjaQueryResponse<NinjaComputerSystem>>(
            "/v2/queries/computer-systems",
            token
          ).catch(() => ({ results: [] as NinjaComputerSystem[] })),
          ninjaRequest<NinjaPatch[] | NinjaQueryResponse<NinjaPatch>>("/v2/queries/os-patches", token).catch(() => ({
            results: [] as NinjaPatch[],
          })),
          ninjaRequest<NinjaPatch[] | NinjaQueryResponse<NinjaPatch>>("/v2/queries/software-patches", token).catch(
            () => ({ results: [] as NinjaPatch[] })
          ),
          ninjaRequest<{ url?: string }>(`/v2/device/${deviceId}/dashboard-url`, token).catch(() => ({ url: null })),
          ninjaRequest<NinjaOrganization[]>("/v2/organizations", token).catch(() => [] as NinjaOrganization[]),
        ]);

      // Extract results
      const osResults = extractResults(osData);
      const computerSystemsResults = extractResults(computerSystemsData);
      const osPatchResults = extractResults(osPatchData);
      const softwarePatchResults = extractResults(softwarePatchData);

      // Filter for this specific device
      const os = osResults.find((o) => o.deviceId === deviceId);
      const computerSystem = computerSystemsResults.find((c) => c.deviceId === deviceId);
      const osPatches = osPatchResults.filter((p) => p.deviceId === deviceId);
      const softwarePatches = softwarePatchResults.filter((p) => p.deviceId === deviceId);

      const osPending = osPatches.filter((p) => p.status !== "INSTALLED");
      const softwarePending = softwarePatches.filter((p) => p.status !== "INSTALLED");

      // Get organization name
      const orgMap = new Map<number, string>();
      if (Array.isArray(organizations)) {
        organizations.forEach((org) => {
          orgMap.set(org.id, org.name);
        });
      }

      return {
        id: device.id,
        name: device.systemName || device.dnsName || "Unknown",
        organizationId: device.organizationId,
        clientName: orgMap.get(device.organizationId) || "Unknown Client",
        status: device.offline === false ? "ONLINE" : "OFFLINE",
        lastContact: timestampToISO(device.lastContact),
        uptime: calculateUptime(os, device, computerSystem),
        os: {
          name: os?.name || device.nodeClass || "Unknown",
          version: os?.version || "",
          type: getOSType(os?.name || "", device.nodeClass || ""),
        },
        patches: {
          osPending: osPending.length,
          softwarePending: softwarePending.length,
          osPendingList: osPending,
          softwarePendingList: softwarePending,
          lastScan: device.lastPatchManagementRun || null,
        },
        details: {
          manufacturer: device.system?.manufacturer,
          model: device.system?.model,
          serialNumber: device.system?.serialNumber,
          biosVersion: device.system?.biosVersion,
        },
        ninjaoneUrl: dashboardUrl?.url || null,
      };
    } catch (error) {
      console.error(`Failed to fetch server details for ${deviceId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Failed to fetch server details from NinjaOne");
    }
  },
});

/**
 * Get all workstations with health and patch information
 */
export const getWorkstations = action({
  args: {},
  handler: async (): Promise<WorkstationResult> => {
    try {
      const token = await getNinjaOneToken();

      // Fetch devices and organizations in parallel
      const [allDevices, organizations] = await Promise.all([
        ninjaRequest<NinjaDevice[]>("/v2/devices", token),
        ninjaRequest<NinjaOrganization[]>("/v2/organizations", token).catch((err) => {
          console.error("NinjaOne: Failed to fetch organizations", { error: err.message });
          return [] as NinjaOrganization[];
        }),
      ]);

      // Filter for workstations (WINDOWS_WORKSTATION and MAC, exclude servers)
      const devices = allDevices.filter((device) => {
        const nodeClass = (device.nodeClass || "").toUpperCase();

        // Include WINDOWS_WORKSTATION and MAC
        // Exclude anything with SERVER in the class name
        return (nodeClass === "WINDOWS_WORKSTATION" || nodeClass === "MAC") && !nodeClass.includes("SERVER");
      });

      // Create organization lookup map
      const orgMap = new Map<number, string>();
      if (Array.isArray(organizations)) {
        organizations.forEach((org) => {
          orgMap.set(org.id, org.name);
        });
      }

      if (!devices || devices.length === 0) {
        return {
          summary: {
            totalWorkstations: 0,
            onlineWorkstations: 0,
            offlineWorkstations: 0,
            workstationsNeedingPatches: 0,
          },
          workstations: [],
          lastUpdated: new Date().toISOString(),
        };
      }

      // Fetch enrichment data in parallel
      const { osMap, computerSystemsMap, osPatchMap, softwarePatchMap } = await fetchEnrichmentData(token);

      // Transform and enrich device data
      const workstations = devices.map((device) =>
        transformDevice(device, orgMap, osMap, computerSystemsMap, osPatchMap, softwarePatchMap, true)
      );

      // Calculate summary statistics
      const onlineWorkstations = workstations.filter((w) => w.status === "ONLINE").length;
      const offlineWorkstations = workstations.filter((w) => w.status === "OFFLINE").length;
      const workstationsNeedingPatches = workstations.filter(
        (w) => w.patches.osPending > 0 || w.patches.softwarePending > 0
      ).length;

      const result: WorkstationResult = {
        summary: {
          totalWorkstations: workstations.length,
          onlineWorkstations,
          offlineWorkstations,
          workstationsNeedingPatches,
        },
        workstations,
        lastUpdated: new Date().toISOString(),
      };

      console.log("NinjaOne: Fetched workstation data", {
        total: result.summary.totalWorkstations,
        online: result.summary.onlineWorkstations,
        needingPatches: result.summary.workstationsNeedingPatches,
      });

      return result;
    } catch (error) {
      console.error("NinjaOne: Failed to fetch workstation data", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Failed to fetch workstation data from NinjaOne");
    }
  },
});

/**
 * Get detailed information for a specific workstation
 */
export const getWorkstationDetails = action({
  args: {
    deviceId: v.number(),
  },
  handler: async (_, { deviceId }): Promise<DeviceDetails> => {
    // Workstations use the same detail structure as servers
    try {
      const token = await getNinjaOneToken();

      const [device, osData, computerSystemsData, osPatchData, softwarePatchData, dashboardUrl, organizations] =
        await Promise.all([
          ninjaRequest<NinjaDevice>(`/v2/device/${deviceId}`, token),
          ninjaRequest<NinjaOSData[] | NinjaQueryResponse<NinjaOSData>>("/v2/queries/operating-systems", token).catch(
            () => ({ results: [] as NinjaOSData[] })
          ),
          ninjaRequest<NinjaComputerSystem[] | NinjaQueryResponse<NinjaComputerSystem>>(
            "/v2/queries/computer-systems",
            token
          ).catch(() => ({ results: [] as NinjaComputerSystem[] })),
          ninjaRequest<NinjaPatch[] | NinjaQueryResponse<NinjaPatch>>("/v2/queries/os-patches", token).catch(() => ({
            results: [] as NinjaPatch[],
          })),
          ninjaRequest<NinjaPatch[] | NinjaQueryResponse<NinjaPatch>>("/v2/queries/software-patches", token).catch(
            () => ({ results: [] as NinjaPatch[] })
          ),
          ninjaRequest<{ url?: string }>(`/v2/device/${deviceId}/dashboard-url`, token).catch(() => ({ url: null })),
          ninjaRequest<NinjaOrganization[]>("/v2/organizations", token).catch(() => [] as NinjaOrganization[]),
        ]);

      // Extract results
      const osResults = extractResults(osData);
      const computerSystemsResults = extractResults(computerSystemsData);
      const osPatchResults = extractResults(osPatchData);
      const softwarePatchResults = extractResults(softwarePatchData);

      // Filter for this specific device
      const os = osResults.find((o) => o.deviceId === deviceId);
      const computerSystem = computerSystemsResults.find((c) => c.deviceId === deviceId);
      const osPatches = osPatchResults.filter((p) => p.deviceId === deviceId);
      const softwarePatches = softwarePatchResults.filter((p) => p.deviceId === deviceId);

      const osPending = osPatches.filter((p) => p.status !== "INSTALLED");
      const softwarePending = softwarePatches.filter((p) => p.status !== "INSTALLED");

      // Get organization name
      const orgMap = new Map<number, string>();
      if (Array.isArray(organizations)) {
        organizations.forEach((org) => {
          orgMap.set(org.id, org.name);
        });
      }

      return {
        id: device.id,
        name: device.systemName || device.dnsName || "Unknown",
        organizationId: device.organizationId,
        clientName: orgMap.get(device.organizationId) || "Unknown Client",
        status: device.offline === false ? "ONLINE" : "OFFLINE",
        lastContact: timestampToISO(device.lastContact),
        uptime: calculateUptime(os, device, computerSystem),
        os: {
          name: os?.name || device.nodeClass || "Unknown",
          version: os?.version || "",
          type: getOSType(os?.name || "", device.nodeClass || "", true),
        },
        patches: {
          osPending: osPending.length,
          softwarePending: softwarePending.length,
          osPendingList: osPending,
          softwarePendingList: softwarePending,
          lastScan: device.lastPatchManagementRun || null,
        },
        details: {
          manufacturer: device.system?.manufacturer,
          model: device.system?.model,
          serialNumber: device.system?.serialNumber,
          biosVersion: device.system?.biosVersion,
        },
        ninjaoneUrl: dashboardUrl?.url || null,
      };
    } catch (error) {
      console.error(`Failed to fetch workstation details for ${deviceId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Failed to fetch workstation details from NinjaOne");
    }
  },
});
