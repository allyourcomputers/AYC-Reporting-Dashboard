import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, requireSuperAdmin } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    if (user.role === "super_admin") {
      return await ctx.db.query("companies").collect();
    }

    // Get companies user belongs to
    const userCompanies = await ctx.db
      .query("userCompanies")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const companyIds = userCompanies.map((uc) => uc.companyId);
    const companies = await Promise.all(
      companyIds.map((id) => ctx.db.get(id))
    );

    return companies.filter(Boolean);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    haloPsaClientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    return await ctx.db.insert("companies", {
      ...args,
      isActive: true,
    });
  },
});
