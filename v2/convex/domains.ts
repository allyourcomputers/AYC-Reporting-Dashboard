import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, requireSuperAdmin } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    const domains = await ctx.db.query("domains").collect();

    // Get company names for assigned domains
    const domainsWithCompanies = await Promise.all(
      domains.map(async (domain) => {
        const company = domain.companyId
          ? await ctx.db.get(domain.companyId)
          : null;
        return {
          ...domain,
          companyName: company?.name ?? null,
        };
      })
    );

    return domainsWithCompanies;
  },
});

export const assign = mutation({
  args: {
    domainId: v.id("domains"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { domainId, companyId }) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    // Verify domain exists
    const domain = await ctx.db.get(domainId);
    if (!domain) {
      throw new Error("Domain not found");
    }

    // Verify company exists
    const company = await ctx.db.get(companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    await ctx.db.patch(domainId, { companyId });
  },
});

export const unassign = mutation({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, { domainId }) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    // Verify domain exists
    const domain = await ctx.db.get(domainId);
    if (!domain) {
      throw new Error("Domain not found");
    }

    await ctx.db.patch(domainId, { companyId: undefined });
  },
});
