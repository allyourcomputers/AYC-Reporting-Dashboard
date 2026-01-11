import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getCompanyFilter } from "./lib/auth";

export const list = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
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

    // Filter by date range if provided
    if (startDate) {
      tickets = tickets.filter((t) => t.dateCreated >= startDate);
    }
    if (endDate) {
      tickets = tickets.filter((t) => t.dateCreated <= endDate);
    }

    return tickets;
  },
});

export const stats = query({
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

    const opened = tickets.length;
    const resolved = tickets.filter((t) => t.dateResolved).length;
    const avgSatisfaction =
      tickets.filter((t) => t.satisfaction).length > 0
        ? tickets
            .filter((t) => t.satisfaction)
            .reduce((sum, t) => sum + (t.satisfaction ?? 0), 0) /
          tickets.filter((t) => t.satisfaction).length
        : null;

    return {
      opened,
      resolved,
      avgSatisfaction,
      openRate: opened > 0 ? ((opened - resolved) / opened) * 100 : 0,
    };
  },
});
