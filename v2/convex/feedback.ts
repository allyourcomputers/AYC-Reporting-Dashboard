import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getCompanyFilter, requireSuperAdmin } from "./lib/auth";

/**
 * List all feedback entries, optionally filtered by company
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const companyFilter = getCompanyFilter(user);

    // Get all feedback
    const feedback = await ctx.db.query("feedback").collect();

    if (!companyFilter) {
      // Super admin without filter sees all
      return feedback;
    }

    // Filter feedback by tickets that belong to the company
    const companyTickets = await ctx.db
      .query("tickets")
      .withIndex("by_company", (q) => q.eq("companyId", companyFilter))
      .collect();

    const companyTicketIds = new Set(companyTickets.map((t) => t._id));

    return feedback.filter((f) => f.ticketId && companyTicketIds.has(f.ticketId));
  },
});

/**
 * Get feedback for a specific ticket
 */
export const getByTicket = query({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, { ticketId }) => {
    const user = await getAuthenticatedUser(ctx);

    // Verify user has access to the ticket
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const companyFilter = getCompanyFilter(user);
    if (companyFilter && ticket.companyId !== companyFilter) {
      throw new Error("Access denied to ticket feedback");
    }

    return await ctx.db
      .query("feedback")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .collect();
  },
});

/**
 * Get feedback by HaloPSA ID
 */
export const getByHaloPsaId = query({
  args: {
    haloPsaId: v.number(),
  },
  handler: async (ctx, { haloPsaId }) => {
    await getAuthenticatedUser(ctx);

    return await ctx.db
      .query("feedback")
      .withIndex("by_halopsa_id", (q) => q.eq("haloPsaId", haloPsaId))
      .unique();
  },
});

/**
 * Upsert a feedback entry (for sync operations)
 * Internal mutation - called by sync actions
 */
export const upsert = internalMutation({
  args: {
    haloPsaId: v.number(),
    ticketId: v.optional(v.id("tickets")),
    haloPsaTicketId: v.number(),
    score: v.optional(v.number()),
    scoreBand: v.optional(v.string()),
    date: v.optional(v.string()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if feedback already exists
    const existing = await ctx.db
      .query("feedback")
      .withIndex("by_halopsa_id", (q) => q.eq("haloPsaId", args.haloPsaId))
      .unique();

    if (existing) {
      // Update existing feedback
      await ctx.db.patch(existing._id, {
        ticketId: args.ticketId,
        haloPsaTicketId: args.haloPsaTicketId,
        score: args.score,
        scoreBand: args.scoreBand,
        date: args.date,
        comment: args.comment,
      });
      return existing._id;
    } else {
      // Insert new feedback
      return await ctx.db.insert("feedback", args);
    }
  },
});

/**
 * Batch upsert feedback entries (for sync operations)
 * Internal mutation - called by sync actions
 */
export const batchUpsert = internalMutation({
  args: {
    feedbackEntries: v.array(
      v.object({
        haloPsaId: v.number(),
        ticketId: v.optional(v.id("tickets")),
        haloPsaTicketId: v.number(),
        score: v.optional(v.number()),
        scoreBand: v.optional(v.string()),
        date: v.optional(v.string()),
        comment: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { feedbackEntries }) => {
    let upsertedCount = 0;

    for (const entry of feedbackEntries) {
      const existing = await ctx.db
        .query("feedback")
        .withIndex("by_halopsa_id", (q) => q.eq("haloPsaId", entry.haloPsaId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ticketId: entry.ticketId,
          haloPsaTicketId: entry.haloPsaTicketId,
          score: entry.score,
          scoreBand: entry.scoreBand,
          date: entry.date,
          comment: entry.comment,
        });
      } else {
        await ctx.db.insert("feedback", entry);
      }
      upsertedCount++;
    }

    return upsertedCount;
  },
});

/**
 * Get feedback statistics for a date range
 */
export const stats = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const user = await getAuthenticatedUser(ctx);
    const companyFilter = getCompanyFilter(user);

    let feedback = await ctx.db.query("feedback").collect();

    // Filter by company if needed
    if (companyFilter) {
      const companyTickets = await ctx.db
        .query("tickets")
        .withIndex("by_company", (q) => q.eq("companyId", companyFilter))
        .collect();

      const companyTicketIds = new Set(companyTickets.map((t) => t._id));
      feedback = feedback.filter((f) => f.ticketId && companyTicketIds.has(f.ticketId));
    }

    // Filter by date range
    feedback = feedback.filter((f) => {
      if (!f.date) return false;
      return f.date >= startDate && f.date <= endDate;
    });

    const totalWithScore = feedback.filter((f) => f.score !== undefined).length;
    const satisfied = feedback.filter((f) => f.score === 1).length;
    const dissatisfied = feedback.filter((f) => f.score === 2).length;

    return {
      total: feedback.length,
      withScore: totalWithScore,
      satisfied,
      dissatisfied,
      satisfactionRate: totalWithScore > 0 ? (satisfied / totalWithScore) * 100 : null,
    };
  },
});
