import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Helper to verify super_admin role for actions
 * Actions can't use ctx.db directly, so we call an internal query
 */
async function verifySuperAdminForAction(ctx: { runQuery: (query: typeof internal.users.verifySuperAdmin, args: Record<string, never>) => Promise<boolean> }): Promise<void> {
  await ctx.runQuery(internal.users.verifySuperAdmin, {});
}

interface SyncResult {
  success: boolean;
  recordsSynced: number;
  error?: string;
}

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

/**
 * Internal mutation to upsert domains from 20i
 */
export const upsertDomains = internalMutation({
  args: {
    domains: v.array(
      v.object({
        twentyiId: v.string(),
        name: v.string(),
        expiryDate: v.string(),
        status: v.union(v.literal("active"), v.literal("expiring-soon"), v.literal("expired")),
        hasHosting: v.boolean(),
        hostingPackageName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { domains }) => {
    let upsertedCount = 0;

    for (const domain of domains) {
      const existing = await ctx.db
        .query("domains")
        .withIndex("by_twentyi_id", (q) => q.eq("twentyiId", domain.twentyiId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: domain.name,
          expiryDate: domain.expiryDate,
          status: domain.status,
          hasHosting: domain.hasHosting,
          hostingPackageName: domain.hostingPackageName,
        });
      } else {
        await ctx.db.insert("domains", {
          twentyiId: domain.twentyiId,
          name: domain.name,
          expiryDate: domain.expiryDate,
          status: domain.status,
          hasHosting: domain.hasHosting,
          hostingPackageName: domain.hostingPackageName,
        });
      }
      upsertedCount++;
    }

    return upsertedCount;
  },
});

/**
 * Sync domains from 20i to domains table
 * Requires super_admin role for manual triggers
 */
export const syncDomains = action({
  args: {},
  handler: async (ctx): Promise<SyncResult> => {
    // Verify super_admin role
    await verifySuperAdminForAction(ctx);

    return await syncDomainsInternal(ctx);
  },
});

/**
 * Internal action for scheduled sync (no auth check needed for cron)
 */
export const scheduledSyncDomains = internalAction({
  args: {},
  handler: async (ctx): Promise<SyncResult> => {
    console.log("=== Starting Scheduled 20i Domain Sync ===");
    console.log(`Time: ${new Date().toISOString()}`);

    return await syncDomainsInternal(ctx);
  },
});

/**
 * Internal helper function for sync operations (shared between manual and scheduled)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncDomainsInternal(ctx: any): Promise<SyncResult> {
  console.log("=== Syncing 20i Domains ===");

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

    console.log(`Fetched ${domains.length} domains and ${packages.length} packages from 20i`);

    // Build package lookup map by domain name for O(1) access
    const packageByDomainName = new Map<string, TwentyiPackage>();
    packages.forEach((pkg) => {
      if (pkg.names && Array.isArray(pkg.names)) {
        pkg.names.forEach((domainName) => {
          packageByDomainName.set(domainName, pkg);
        });
      }
    });

    // Transform domains for Convex schema
    const transformedDomains = domains.map((domain) => {
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
        twentyiId: String(domain.id),
        name: domainName,
        expiryDate: expiryDate.toISOString(),
        status,
        hasHosting: !!hostingPackage,
        hostingPackageName: hostingPackage?.packageTypeName,
      };
    });

    // Batch upsert in chunks of 500
    const batchSize = 500;
    let totalUpserted = 0;

    for (let i = 0; i < transformedDomains.length; i += batchSize) {
      const batch = transformedDomains.slice(i, i + batchSize);
      console.log(`Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedDomains.length / batchSize)}`);

      const count = await ctx.runMutation(internal.twentyi.upsertDomains, {
        domains: batch,
      });
      totalUpserted += count;
    }

    console.log(`Successfully synced ${totalUpserted} domains`);

    // Record sync metadata
    await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
      syncType: "domains",
      recordsSynced: totalUpserted,
      status: "success",
    });

    return { success: true, recordsSynced: totalUpserted };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error syncing domains:", errorMessage);

    await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
      syncType: "domains",
      recordsSynced: 0,
      status: "failed",
      errorMessage,
    });

    return { success: false, recordsSynced: 0, error: errorMessage };
  }
}
