import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, requireSuperAdmin } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);
    return await ctx.db.query("syncMetadata").order("desc").take(20);
  },
});

export const getLatestByType = query({
  args: { syncType: v.string() },
  handler: async (ctx, { syncType }) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);
    return await ctx.db
      .query("syncMetadata")
      .withIndex("by_sync_type", (q) => q.eq("syncType", syncType))
      .order("desc")
      .first();
  },
});
