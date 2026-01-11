import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getCompanyFilter } from "./lib/auth";

export const monthlyStats = query({
  args: {
    companyId: v.optional(v.id("companies")),
    startMonth: v.string(), // YYYY-MM format
    endMonth: v.string(),   // YYYY-MM format
  },
  handler: async (ctx, { companyId, startMonth, endMonth }) => {
    const user = await getAuthenticatedUser(ctx);

    // Use provided companyId or user's company filter
    const filterCompanyId = companyId ?? getCompanyFilter(user);

    let tickets = filterCompanyId
      ? await ctx.db
          .query("tickets")
          .withIndex("by_company", (q) => q.eq("companyId", filterCompanyId))
          .collect()
      : await ctx.db.query("tickets").collect();

    // Parse date range
    const startDate = new Date(startMonth + "-01").getTime();
    const endDate = new Date(endMonth + "-01");
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0); // Last day of end month
    const endTimestamp = endDate.getTime() + 86400000 - 1; // End of day

    // Filter by date range
    tickets = tickets.filter(
      (t) => t.dateCreated >= startDate && t.dateCreated <= endTimestamp
    );

    // Group by month
    const monthlyMap = new Map<string, { total: number; closed: number }>();

    // Initialize all months in range
    const current = new Date(startMonth + "-01");
    const end = new Date(endMonth + "-01");
    while (current <= end) {
      const monthKey = current.toISOString().slice(0, 7);
      monthlyMap.set(monthKey, { total: 0, closed: 0 });
      current.setMonth(current.getMonth() + 1);
    }

    // Count tickets by month
    for (const ticket of tickets) {
      const monthKey = new Date(ticket.dateCreated).toISOString().slice(0, 7);
      const entry = monthlyMap.get(monthKey);
      if (entry) {
        entry.total++;
        if (ticket.dateResolved) {
          entry.closed++;
        }
      }
    }

    // Convert to array
    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        monthLabel: new Date(month + "-01").toLocaleDateString("en-GB", { year: "numeric", month: "long" }),
        totalTickets: data.total,
        closedTickets: data.closed,
        openTickets: data.total - data.closed,
        closeRate: data.total > 0 ? ((data.closed / data.total) * 100) : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  },
});
