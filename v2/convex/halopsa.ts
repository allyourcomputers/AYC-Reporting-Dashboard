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
import type { Id } from "./_generated/dataModel";

// Types for HaloPSA API responses
interface HaloClient {
  id: number;
  name: string;
  toplevel_id?: number;
  toplevel_name?: string;
  inactive?: boolean;
  colour?: string;
}

interface HaloTicket {
  id: number;
  client_id: number;
  client_name?: string;
  site_id?: number;
  site_name?: string;
  user_id?: number;
  user_name?: string;
  summary: string;
  details?: string;
  status_id: number;
  statusname?: string;
  status?: string;
  priority_id?: number;
  tickettype_id?: number;
  team_id?: number;
  team?: string;
  agent_id?: number;
  dateoccurred?: string;
  dateclosed?: string;
  responsedate?: string;
  lastactiondate?: string;
}

interface HaloFeedback {
  id: number;
  ticket_id: number;
  score?: number;
  score_band?: string;
  date?: string;
  comment?: string;
  ip_address?: string;
}

interface HaloPaginatedResponse<T> {
  record_count?: number;
  clients?: T[];
  tickets?: T[];
  [key: string]: T[] | number | undefined;
}

interface SyncResult {
  success: boolean;
  recordsSynced: number;
  error?: string;
}

/**
 * Get OAuth2 access token from HaloPSA
 */
async function getHaloAccessToken(): Promise<string> {
  const apiUrl = process.env.HALO_API_URL;
  const clientId = process.env.HALO_CLIENT_ID;
  const clientSecret = process.env.HALO_CLIENT_SECRET;

  if (!apiUrl || !clientId || !clientSecret) {
    throw new Error("HaloPSA credentials not configured in environment variables");
  }

  // Auth URL is /auth/token relative to the API base
  const authUrl = apiUrl.replace("/api", "/auth");

  try {
    const response = await fetch(`${authUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "all",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HaloPSA token request failed", {
        status: response.status,
        error: errorText,
      });
      throw new Error("Failed to authenticate with HaloPSA");
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to get HaloPSA token", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Failed to authenticate with HaloPSA");
  }
}

/**
 * Make authenticated request to HaloPSA API
 */
async function haloRequest<T>(
  endpoint: string,
  token: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const apiUrl = process.env.HALO_API_URL;

  const url = new URL(`${apiUrl}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HaloPSA API request failed: ${endpoint}`, {
        status: response.status,
        error: errorText,
      });
      throw new Error(`HaloPSA API request failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`HaloPSA API request timed out: ${endpoint}`);
    }
    console.error(`HaloPSA API request failed: ${endpoint}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Fetch all items with pagination from HaloPSA
 */
async function fetchAllItems<T>(
  token: string,
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T[]> {
  const allItems: T[] = [];
  let pageNo = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await haloRequest<HaloPaginatedResponse<T>>(endpoint, token, {
      ...params,
      pageinate: "true",
      page_size: 100,
      page_no: pageNo,
    });

    // HaloPSA returns data under different keys depending on endpoint
    const endpointKey = endpoint.toLowerCase();
    const items =
      (response[endpointKey] as T[]) ||
      response.tickets ||
      response.clients ||
      (Array.isArray(response) ? response : []);

    allItems.push(...items);

    const recordCount = response.record_count || 0;

    console.log(
      `  HaloPSA ${endpoint} Page ${pageNo}: Fetched ${items.length} items, Total: ${allItems.length}/${recordCount}`
    );

    if (allItems.length >= recordCount || items.length === 0) {
      hasMore = false;
    } else {
      pageNo++;
    }
  }

  return allItems;
}

/**
 * Internal mutation to upsert companies from HaloPSA clients
 */
export const upsertCompanies = internalMutation({
  args: {
    clients: v.array(
      v.object({
        haloPsaClientId: v.string(),
        name: v.string(),
        isActive: v.boolean(),
      })
    ),
  },
  handler: async (ctx, { clients }) => {
    let upsertedCount = 0;

    for (const client of clients) {
      const existing = await ctx.db
        .query("companies")
        .withIndex("by_halopsa_id", (q) => q.eq("haloPsaClientId", client.haloPsaClientId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: client.name,
          isActive: client.isActive,
        });
      } else {
        await ctx.db.insert("companies", {
          haloPsaClientId: client.haloPsaClientId,
          name: client.name,
          isActive: client.isActive,
        });
      }
      upsertedCount++;
    }

    return upsertedCount;
  },
});

/**
 * Internal mutation to upsert tickets from HaloPSA
 */
export const upsertTickets = internalMutation({
  args: {
    tickets: v.array(
      v.object({
        haloPsaId: v.string(),
        haloPsaClientId: v.string(),
        summary: v.string(),
        status: v.string(),
        priority: v.optional(v.string()),
        category: v.optional(v.string()),
        dateCreated: v.number(),
        dateResolved: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, { tickets }) => {
    let upsertedCount = 0;

    for (const ticket of tickets) {
      // Find the company by HaloPSA client ID (use first() to handle potential duplicates)
      const company = await ctx.db
        .query("companies")
        .withIndex("by_halopsa_id", (q) => q.eq("haloPsaClientId", ticket.haloPsaClientId))
        .first();

      if (!company) {
        console.log(`Skipping ticket ${ticket.haloPsaId} - company not found for client ${ticket.haloPsaClientId}`);
        continue;
      }

      const existing = await ctx.db
        .query("tickets")
        .withIndex("by_halopsa_id", (q) => q.eq("haloPsaId", ticket.haloPsaId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          companyId: company._id,
          summary: ticket.summary,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          dateCreated: ticket.dateCreated,
          dateResolved: ticket.dateResolved,
        });
      } else {
        await ctx.db.insert("tickets", {
          companyId: company._id,
          haloPsaId: ticket.haloPsaId,
          summary: ticket.summary,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          dateCreated: ticket.dateCreated,
          dateResolved: ticket.dateResolved,
        });
      }
      upsertedCount++;
    }

    return upsertedCount;
  },
});

/**
 * Internal mutation to record sync metadata
 */
export const recordSyncMetadata = internalMutation({
  args: {
    syncType: v.string(),
    recordsSynced: v.number(),
    status: v.union(v.literal("success"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { syncType, recordsSynced, status, errorMessage }) => {
    return await ctx.db.insert("syncMetadata", {
      syncType,
      lastSync: new Date().toISOString(),
      recordsSynced,
      status,
      errorMessage,
    });
  },
});

/**
 * Sync clients from HaloPSA to companies table
 * Requires super_admin role for manual triggers
 */
export const syncClients = action({
  args: {},
  handler: async (ctx): Promise<SyncResult> => {
    // Verify super_admin role
    await verifySuperAdminForAction(ctx);

    console.log("=== Syncing HaloPSA Clients ===");

    try {
      const token = await getHaloAccessToken();
      const clients = await fetchAllItems<HaloClient>(token, "Client");

      console.log(`Fetched ${clients.length} clients from HaloPSA`);

      // Transform clients for Convex schema
      const transformedClients = clients.map((client) => ({
        haloPsaClientId: String(client.id),
        name: client.name,
        isActive: !client.inactive,
      }));

      // Batch upsert in chunks of 500
      const batchSize = 500;
      let totalUpserted = 0;

      for (let i = 0; i < transformedClients.length; i += batchSize) {
        const batch = transformedClients.slice(i, i + batchSize);
        console.log(`Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedClients.length / batchSize)}`);

        const count = await ctx.runMutation(internal.halopsa.upsertCompanies, {
          clients: batch,
        });
        totalUpserted += count;
      }

      console.log(`Successfully synced ${totalUpserted} clients`);

      // Record sync metadata
      await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
        syncType: "clients",
        recordsSynced: totalUpserted,
        status: "success",
      });

      return { success: true, recordsSynced: totalUpserted };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error syncing clients:", errorMessage);

      await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
        syncType: "clients",
        recordsSynced: 0,
        status: "failed",
        errorMessage,
      });

      return { success: false, recordsSynced: 0, error: errorMessage };
    }
  },
});

/**
 * Sync tickets from HaloPSA with date range filtering
 * Requires super_admin role for manual triggers
 */
export const syncTickets = action({
  args: {
    monthsBack: v.optional(v.number()),
  },
  handler: async (ctx, { monthsBack = 12 }): Promise<SyncResult> => {
    // Verify super_admin role
    await verifySuperAdminForAction(ctx);

    console.log(`=== Syncing HaloPSA Tickets (last ${monthsBack} months) ===`);

    try {
      const token = await getHaloAccessToken();

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      console.log(`Fetching tickets from ${startDateStr} to ${endDateStr}`);

      const tickets = await fetchAllItems<HaloTicket>(token, "Tickets", {
        startdate: startDateStr,
        enddate: endDateStr,
      });

      console.log(`Fetched ${tickets.length} tickets from HaloPSA`);

      // Transform tickets for Convex schema
      const transformedTickets = tickets.map((ticket) => {
        // Parse dates to timestamps
        const dateCreated = ticket.dateoccurred
          ? new Date(ticket.dateoccurred).getTime()
          : Date.now();

        const dateResolved = ticket.dateclosed
          ? new Date(ticket.dateclosed).getTime()
          : undefined;

        // Determine status string
        const status =
          ticket.statusname ||
          ticket.status ||
          (ticket.status_id === 9 ? "Closed" : "Open");

        return {
          haloPsaId: String(ticket.id),
          haloPsaClientId: String(ticket.client_id),
          summary: ticket.summary || "",
          status,
          priority: ticket.priority_id ? String(ticket.priority_id) : undefined,
          category: ticket.tickettype_id ? String(ticket.tickettype_id) : undefined,
          dateCreated,
          dateResolved,
        };
      });

      // Batch upsert in chunks of 500
      const batchSize = 500;
      let totalUpserted = 0;

      for (let i = 0; i < transformedTickets.length; i += batchSize) {
        const batch = transformedTickets.slice(i, i + batchSize);
        console.log(`Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedTickets.length / batchSize)}`);

        const count = await ctx.runMutation(internal.halopsa.upsertTickets, {
          tickets: batch,
        });
        totalUpserted += count;
      }

      console.log(`Successfully synced ${totalUpserted} tickets`);

      // Record sync metadata
      await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
        syncType: "tickets",
        recordsSynced: totalUpserted,
        status: "success",
      });

      return { success: true, recordsSynced: totalUpserted };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error syncing tickets:", errorMessage);

      await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
        syncType: "tickets",
        recordsSynced: 0,
        status: "failed",
        errorMessage,
      });

      return { success: false, recordsSynced: 0, error: errorMessage };
    }
  },
});

/**
 * Internal mutation to get ticket ID by HaloPSA ticket ID
 */
export const getTicketIdByHaloPsaId = internalMutation({
  args: {
    haloPsaTicketId: v.string(),
  },
  handler: async (ctx, { haloPsaTicketId }): Promise<Id<"tickets"> | null> => {
    const ticket = await ctx.db
      .query("tickets")
      .withIndex("by_halopsa_id", (q) => q.eq("haloPsaId", haloPsaTicketId))
      .unique();

    return ticket?._id ?? null;
  },
});

/**
 * Internal mutation to get all ticket HaloPSA IDs and their Convex IDs
 */
export const getTicketIdMap = internalMutation({
  args: {},
  handler: async (ctx): Promise<Array<{ haloPsaId: string; _id: Id<"tickets"> }>> => {
    const tickets = await ctx.db.query("tickets").collect();
    return tickets.map((t) => ({ haloPsaId: t.haloPsaId, _id: t._id }));
  },
});

/**
 * Sync feedback from HaloPSA
 * Requires super_admin role for manual triggers
 */
export const syncFeedback = action({
  args: {},
  handler: async (ctx): Promise<SyncResult> => {
    // Verify super_admin role
    await verifySuperAdminForAction(ctx);

    console.log("=== Syncing HaloPSA Feedback ===");

    try {
      const token = await getHaloAccessToken();

      // Fetch feedback - may return as array directly
      let allFeedback: HaloFeedback[] = [];
      let pageNo = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await haloRequest<HaloFeedback[] | HaloPaginatedResponse<HaloFeedback>>(
          "Feedback",
          token,
          {
            pageinate: "true",
            page_size: 100,
            page_no: pageNo,
          }
        );

        // Feedback may be returned directly as an array
        const items = Array.isArray(response) ? response : [];

        if (items.length === 0) {
          hasMore = false;
        } else {
          allFeedback = allFeedback.concat(items);
          console.log(`  Page ${pageNo}: Fetched ${items.length} items, Total: ${allFeedback.length}`);

          // If we got less than page_size, we've reached the end
          if (items.length < 100) {
            hasMore = false;
          } else {
            pageNo++;
          }
        }
      }

      console.log(`Fetched ${allFeedback.length} feedback entries from HaloPSA`);

      if (allFeedback.length === 0) {
        console.log("No feedback data to sync");

        await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
          syncType: "feedback",
          recordsSynced: 0,
          status: "success",
        });

        return { success: true, recordsSynced: 0 };
      }

      // Get all ticket IDs from our database to map feedback to tickets
      const ticketIdMap = await ctx.runMutation(internal.halopsa.getTicketIdMap, {});
      const ticketLookup = new Map(ticketIdMap.map((t) => [t.haloPsaId, t._id]));

      // Transform feedback for batch upsert
      const transformedFeedback = allFeedback.map((feedback) => {
        const ticketId = ticketLookup.get(String(feedback.ticket_id));

        return {
          haloPsaId: feedback.id,
          ticketId: ticketId,
          haloPsaTicketId: feedback.ticket_id,
          score: feedback.score,
          scoreBand: feedback.score_band != null ? String(feedback.score_band) : undefined,
          date: feedback.date,
          comment: feedback.comment,
        };
      });

      // Batch upsert in chunks of 500
      const batchSize = 500;
      let totalUpserted = 0;

      for (let i = 0; i < transformedFeedback.length; i += batchSize) {
        const batch = transformedFeedback.slice(i, i + batchSize);
        console.log(`Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedFeedback.length / batchSize)}`);

        const count = await ctx.runMutation(internal.feedback.batchUpsert, {
          feedbackEntries: batch,
        });
        totalUpserted += count;
      }

      console.log(`Successfully synced ${totalUpserted} feedback entries`);

      // Calculate satisfaction stats
      const totalWithScore = transformedFeedback.filter((f) => f.score !== undefined).length;
      const satisfied = transformedFeedback.filter((f) => f.score === 1).length;

      if (totalWithScore > 0) {
        console.log(`  Satisfaction: ${satisfied}/${totalWithScore} (${((satisfied / totalWithScore) * 100).toFixed(1)}%)`);
      }

      // Record sync metadata
      await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
        syncType: "feedback",
        recordsSynced: totalUpserted,
        status: "success",
      });

      return { success: true, recordsSynced: totalUpserted };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error syncing feedback:", errorMessage);

      await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
        syncType: "feedback",
        recordsSynced: 0,
        status: "failed",
        errorMessage,
      });

      return { success: false, recordsSynced: 0, error: errorMessage };
    }
  },
});

/**
 * Perform a full sync of all HaloPSA data
 * Runs clients, tickets, and feedback sync in order
 */
export const performFullSync = action({
  args: {
    monthsBack: v.optional(v.number()),
  },
  handler: async (ctx, { monthsBack = 12 }): Promise<{
    clientsResult: SyncResult;
    ticketsResult: SyncResult;
    feedbackResult: SyncResult;
  }> => {
    // Verify super_admin role
    await verifySuperAdminForAction(ctx);

    console.log("=== Starting Full HaloPSA Sync ===");
    console.log(`Time: ${new Date().toISOString()}`);

    // Sync in order: clients first (needed for tickets), then tickets, then feedback
    const clientsResult = await syncClientsInternal(ctx);
    const ticketsResult = await syncTicketsInternal(ctx, monthsBack);
    const feedbackResult = await syncFeedbackInternal(ctx);

    console.log("\n=== Full Sync Complete ===");
    console.log(`Clients synced: ${clientsResult.recordsSynced}`);
    console.log(`Tickets synced: ${ticketsResult.recordsSynced}`);
    console.log(`Feedback synced: ${feedbackResult.recordsSynced}`);
    console.log(`Finished: ${new Date().toISOString()}`);

    return {
      clientsResult,
      ticketsResult,
      feedbackResult,
    };
  },
});

/**
 * Internal action for scheduled sync (no auth check needed for cron)
 */
export const scheduledFullSync = internalAction({
  args: {
    monthsBack: v.optional(v.number()),
  },
  handler: async (ctx, { monthsBack = 12 }): Promise<{
    clientsResult: SyncResult;
    ticketsResult: SyncResult;
    feedbackResult: SyncResult;
  }> => {
    console.log("=== Starting Scheduled HaloPSA Sync ===");
    console.log(`Time: ${new Date().toISOString()}`);

    // Sync in order: clients first (needed for tickets), then tickets, then feedback
    const clientsResult = await syncClientsInternal(ctx);
    const ticketsResult = await syncTicketsInternal(ctx, monthsBack);
    const feedbackResult = await syncFeedbackInternal(ctx);

    console.log("\n=== Scheduled Sync Complete ===");
    console.log(`Clients synced: ${clientsResult.recordsSynced}`);
    console.log(`Tickets synced: ${ticketsResult.recordsSynced}`);
    console.log(`Feedback synced: ${feedbackResult.recordsSynced}`);
    console.log(`Finished: ${new Date().toISOString()}`);

    return {
      clientsResult,
      ticketsResult,
      feedbackResult,
    };
  },
});

// Internal helper functions for sync operations (shared between manual and scheduled)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncClientsInternal(ctx: any): Promise<SyncResult> {
  console.log("=== Syncing HaloPSA Clients ===");

  try {
    const token = await getHaloAccessToken();
    const clients = await fetchAllItems<HaloClient>(token, "Client");

    console.log(`Fetched ${clients.length} clients from HaloPSA`);

    const transformedClients = clients.map((client) => ({
      haloPsaClientId: String(client.id),
      name: client.name,
      isActive: !client.inactive,
    }));

    const batchSize = 500;
    let totalUpserted = 0;

    for (let i = 0; i < transformedClients.length; i += batchSize) {
      const batch = transformedClients.slice(i, i + batchSize);
      const count = await ctx.runMutation(internal.halopsa.upsertCompanies, {
        clients: batch,
      });
      totalUpserted += count;
    }

    console.log(`Successfully synced ${totalUpserted} clients`);

    await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
      syncType: "clients",
      recordsSynced: totalUpserted,
      status: "success",
    });

    return { success: true, recordsSynced: totalUpserted };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error syncing clients:", errorMessage);

    await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
      syncType: "clients",
      recordsSynced: 0,
      status: "failed",
      errorMessage,
    });

    return { success: false, recordsSynced: 0, error: errorMessage };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncTicketsInternal(ctx: any, monthsBack: number): Promise<SyncResult> {
  console.log(`=== Syncing HaloPSA Tickets (last ${monthsBack} months) ===`);

  try {
    const token = await getHaloAccessToken();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    console.log(`Fetching tickets from ${startDateStr} to ${endDateStr}`);

    const tickets = await fetchAllItems<HaloTicket>(token, "Tickets", {
      startdate: startDateStr,
      enddate: endDateStr,
    });

    console.log(`Fetched ${tickets.length} tickets from HaloPSA`);

    const transformedTickets = tickets.map((ticket) => {
      const dateCreated = ticket.dateoccurred
        ? new Date(ticket.dateoccurred).getTime()
        : Date.now();

      const dateResolved = ticket.dateclosed
        ? new Date(ticket.dateclosed).getTime()
        : undefined;

      const status =
        ticket.statusname ||
        ticket.status ||
        (ticket.status_id === 9 ? "Closed" : "Open");

      return {
        haloPsaId: String(ticket.id),
        haloPsaClientId: String(ticket.client_id),
        summary: ticket.summary || "",
        status,
        priority: ticket.priority_id ? String(ticket.priority_id) : undefined,
        category: ticket.tickettype_id ? String(ticket.tickettype_id) : undefined,
        dateCreated,
        dateResolved,
      };
    });

    const batchSize = 500;
    let totalUpserted = 0;

    for (let i = 0; i < transformedTickets.length; i += batchSize) {
      const batch = transformedTickets.slice(i, i + batchSize);
      const count = await ctx.runMutation(internal.halopsa.upsertTickets, {
        tickets: batch,
      });
      totalUpserted += count;
    }

    console.log(`Successfully synced ${totalUpserted} tickets`);

    await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
      syncType: "tickets",
      recordsSynced: totalUpserted,
      status: "success",
    });

    return { success: true, recordsSynced: totalUpserted };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error syncing tickets:", errorMessage);

    await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
      syncType: "tickets",
      recordsSynced: 0,
      status: "failed",
      errorMessage,
    });

    return { success: false, recordsSynced: 0, error: errorMessage };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncFeedbackInternal(ctx: any): Promise<SyncResult> {
  console.log("=== Syncing HaloPSA Feedback ===");

  try {
    const token = await getHaloAccessToken();

    let allFeedback: HaloFeedback[] = [];
    let pageNo = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await haloRequest<HaloFeedback[] | HaloPaginatedResponse<HaloFeedback>>(
        "Feedback",
        token,
        {
          pageinate: "true",
          page_size: 100,
          page_no: pageNo,
        }
      );

      const items = Array.isArray(response) ? response : [];

      if (items.length === 0) {
        hasMore = false;
      } else {
        allFeedback = allFeedback.concat(items);
        console.log(`  Page ${pageNo}: Fetched ${items.length} items, Total: ${allFeedback.length}`);

        if (items.length < 100) {
          hasMore = false;
        } else {
          pageNo++;
        }
      }
    }

    console.log(`Fetched ${allFeedback.length} feedback entries from HaloPSA`);

    if (allFeedback.length === 0) {
      console.log("No feedback data to sync");

      await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
        syncType: "feedback",
        recordsSynced: 0,
        status: "success",
      });

      return { success: true, recordsSynced: 0 };
    }

    const ticketIdMap: Array<{ haloPsaId: string; _id: Id<"tickets"> }> = await ctx.runMutation(internal.halopsa.getTicketIdMap, {});
    const ticketLookup = new Map(ticketIdMap.map((t: { haloPsaId: string; _id: Id<"tickets"> }) => [t.haloPsaId, t._id]));

    const transformedFeedback = allFeedback.map((feedback) => {
      const ticketId = ticketLookup.get(String(feedback.ticket_id));

      return {
        haloPsaId: feedback.id,
        ticketId: ticketId,
        haloPsaTicketId: feedback.ticket_id,
        score: feedback.score,
        scoreBand: feedback.score_band != null ? String(feedback.score_band) : undefined,
        date: feedback.date,
        comment: feedback.comment,
      };
    });

    const batchSize = 500;
    let totalUpserted = 0;

    for (let i = 0; i < transformedFeedback.length; i += batchSize) {
      const batch = transformedFeedback.slice(i, i + batchSize);
      const count = await ctx.runMutation(internal.feedback.batchUpsert, {
        feedbackEntries: batch,
      });
      totalUpserted += count;
    }

    console.log(`Successfully synced ${totalUpserted} feedback entries`);

    await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
      syncType: "feedback",
      recordsSynced: totalUpserted,
      status: "success",
    });

    return { success: true, recordsSynced: totalUpserted };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error syncing feedback:", errorMessage);

    await ctx.runMutation(internal.halopsa.recordSyncMetadata, {
      syncType: "feedback",
      recordsSynced: 0,
      status: "failed",
      errorMessage,
    });

    return { success: false, recordsSynced: 0, error: errorMessage };
  }
}
