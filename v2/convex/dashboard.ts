import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getCompanyFilter } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

export const trends = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const user = await getAuthenticatedUser(ctx);
    const companyFilter = getCompanyFilter(user);

    let tickets = companyFilter
      ? await ctx.db
          .query("tickets")
          .withIndex("by_company", (q) => q.eq("companyId", companyFilter))
          .collect()
      : await ctx.db.query("tickets").collect();

    // Filter by date range
    tickets = tickets.filter(
      (t) => t.dateCreated >= startDate && t.dateCreated <= endDate
    );

    // Group by day
    const trendMap = new Map<string, { opened: number; resolved: number }>();

    for (const ticket of tickets) {
      const date = new Date(ticket.dateCreated).toISOString().split("T")[0];
      const current = trendMap.get(date) ?? { opened: 0, resolved: 0 };
      current.opened++;
      if (ticket.dateResolved) {
        current.resolved++;
      }
      trendMap.set(date, current);
    }

    return Array.from(trendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const topClients = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { startDate, endDate, limit = 5 }) => {
    const user = await getAuthenticatedUser(ctx);
    const companyFilter = getCompanyFilter(user);

    // Skip if user has a specific company selected
    if (companyFilter) {
      return [];
    }

    const tickets = await ctx.db.query("tickets").collect();
    const filteredTickets = tickets.filter(
      (t) => t.dateCreated >= startDate && t.dateCreated <= endDate
    );

    // Count by company
    const countMap = new Map<Id<"companies">, number>();
    for (const ticket of filteredTickets) {
      const count = countMap.get(ticket.companyId) ?? 0;
      countMap.set(ticket.companyId, count + 1);
    }

    // Get top companies
    const sorted = Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    // Fetch company names
    const results = await Promise.all(
      sorted.map(async ([companyId, ticketCount]) => {
        const company = await ctx.db.get(companyId);
        return {
          companyId,
          companyName: company?.name ?? "Unknown",
          ticketCount,
        };
      })
    );

    return results;
  },
});
