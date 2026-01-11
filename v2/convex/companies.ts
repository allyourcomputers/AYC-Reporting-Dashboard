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

export const update = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    haloPsaClientId: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, { companyId, name, haloPsaClientId, isActive }) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    await ctx.db.patch(companyId, { name, haloPsaClientId, isActive });
    return companyId;
  },
});

export const remove = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    // Check if company has assigned users
    const userAssocs = await ctx.db
      .query("userCompanies")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .first();

    if (userAssocs) {
      throw new Error("Cannot delete company with assigned users");
    }

    await ctx.db.delete(companyId);
  },
});

export const listWithUserCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    const companies = await ctx.db.query("companies").collect();

    const companiesWithUserCount = await Promise.all(
      companies.map(async (company) => {
        const userAssocs = await ctx.db
          .query("userCompanies")
          .withIndex("by_company", (q) => q.eq("companyId", company._id))
          .collect();
        return {
          ...company,
          userCount: userAssocs.length,
        };
      })
    );

    return companiesWithUserCount;
  },
});
