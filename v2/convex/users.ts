import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, requireSuperAdmin } from "./lib/auth";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return user;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);
    return await ctx.db.query("users").collect();
  },
});

export const switchCompany = mutation({
  args: { companyId: v.optional(v.id("companies")) },
  handler: async (ctx, { companyId }) => {
    const user = await getAuthenticatedUser(ctx);
    const realUser = user.realUser ?? user;

    await ctx.db.patch(realUser._id, { activeCompanyId: companyId });
    return { success: true };
  },
});

export const startImpersonation = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    await ctx.db.patch(user._id, { impersonatingUserId: userId });
    return { success: true };
  },
});

export const stopImpersonation = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user.realUser) {
      throw new Error("Not currently impersonating");
    }

    await ctx.db.patch(user.realUser._id, { impersonatingUserId: undefined });
    return { success: true };
  },
});
