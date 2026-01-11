import { action } from "./_generated/server";

// Types for 20i API responses
interface TwentyiDomain {
  id: string;
  name: string;
  expiryDate: string;
}

interface TwentyiPackage {
  id: string;
  name?: string;
  names?: string[];
  packageTypeName?: string;
  stackUsers?: string[];
}

interface DomainInfo {
  id: string;
  name: string;
  expiryDate: string;
  daysUntilExpiry: number;
  status: "active" | "expiring-soon" | "expired";
  hasHosting: boolean;
  hostingPackageName: string | null;
}

interface DomainsResult {
  summary: {
    totalDomains: number;
    domainsWithHosting: number;
    domainsExpiringSoon: number;
  };
  domains: DomainInfo[];
  lastUpdated: string;
}

/**
 * Get authentication token for 20i API
 * Uses base64-encoded API key as Bearer token
 */
function get20iToken(): string {
  const apiKey = process.env.TWENTYI_API_KEY;

  if (!apiKey) {
    throw new Error("20i API credentials not configured in environment variables");
  }

  // 20i API requires base64-encoded API key as Bearer token
  return Buffer.from(apiKey).toString("base64");
}

/**
 * Make authenticated request to 20i API
 */
async function twentyiRequest<T>(endpoint: string): Promise<T> {
  const token = get20iToken();
  const baseUrl = "https://api.20i.com";

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
      console.error(`20i API request failed: ${endpoint}`, {
        status: response.status,
        error: errorText,
      });
      throw new Error(`20i API request failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`20i API request timed out: ${endpoint}`);
    }
    console.error(`20i API request failed: ${endpoint}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get all domains with hosting status from 20i
 */
export const getDomains = action({
  args: {},
  handler: async (ctx): Promise<DomainsResult> => {
    // Require authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Must be logged in to access domain data");
    }

    try {
      // Fetch domains and packages in parallel
      const [domainsResponse, packagesResponse] = await Promise.all([
        twentyiRequest<TwentyiDomain[]>("/domain").catch((err) => {
          console.error("20i: Failed to fetch domains", { error: err.message });
          return [] as TwentyiDomain[];
        }),
        twentyiRequest<TwentyiPackage[]>("/package").catch((err) => {
          console.error("20i: Failed to fetch packages", { error: err.message });
          return [] as TwentyiPackage[];
        }),
      ]);

      const domains = Array.isArray(domainsResponse) ? domainsResponse : [];
      const packages = Array.isArray(packagesResponse) ? packagesResponse : [];

      // Build package lookup map by domain name for O(1) access
      const packageByDomainName = new Map<string, TwentyiPackage>();
      packages.forEach((pkg) => {
        // Packages have a 'names' array containing domain names
        if (pkg.names && Array.isArray(pkg.names)) {
          pkg.names.forEach((domainName) => {
            packageByDomainName.set(domainName, pkg);
          });
        }
      });

      // Transform and enrich domains with hosting status
      const enrichedDomains: DomainInfo[] = domains.map((domain) => {
        const domainName = domain.name;
        const expiryDate = new Date(domain.expiryDate);
        const now = new Date();
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Determine status based on days until expiry
        let status: "active" | "expiring-soon" | "expired" = "active";
        if (daysUntilExpiry < 0) {
          status = "expired";
        } else if (daysUntilExpiry <= 30) {
          status = "expiring-soon";
        }

        // Check for hosting package by domain name
        const hostingPackage = packageByDomainName.get(domainName);

        return {
          id: String(domain.id),
          name: domainName,
          expiryDate: expiryDate.toISOString(),
          daysUntilExpiry,
          status,
          hasHosting: !!hostingPackage,
          hostingPackageName: hostingPackage?.packageTypeName || null,
        };
      });

      // Calculate summary statistics
      const summary = {
        totalDomains: enrichedDomains.length,
        domainsWithHosting: enrichedDomains.filter((d) => d.hasHosting).length,
        domainsExpiringSoon: enrichedDomains.filter(
          (d) => d.status === "expiring-soon" || d.status === "expired"
        ).length,
      };

      const result: DomainsResult = {
        summary,
        domains: enrichedDomains,
        lastUpdated: new Date().toISOString(),
      };

      console.log("20i: Fetched domain data", {
        total: summary.totalDomains,
        withHosting: summary.domainsWithHosting,
        expiring: summary.domainsExpiringSoon,
      });

      return result;
    } catch (error) {
      console.error("20i: Failed to fetch domain data", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Failed to fetch domain data from 20i");
    }
  },
});
