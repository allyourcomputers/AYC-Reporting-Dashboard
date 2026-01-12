import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Migration utilities for importing data from Supabase
 * Note: These mutations are public during migration, remove after migration is complete
 */

// Import a company
export const importCompany = mutation({
  args: {
    supabaseId: v.string(), // Original Supabase UUID for mapping
    name: v.string(),
    haloPsaClientId: v.optional(v.string()),
    logo: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check if company already exists by name
    const existing = await ctx.db
      .query("companies")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      // Update existing company
      await ctx.db.patch(existing._id, {
        haloPsaClientId: args.haloPsaClientId,
        logo: args.logo,
        isActive: args.isActive,
      });
      return { id: existing._id, supabaseId: args.supabaseId, created: false };
    }

    // Create new company
    const id = await ctx.db.insert("companies", {
      name: args.name,
      haloPsaClientId: args.haloPsaClientId,
      logo: args.logo,
      isActive: args.isActive,
    });

    return { id, supabaseId: args.supabaseId, created: true };
  },
});

// Import a user
export const importUser = mutation({
  args: {
    supabaseUserId: v.string(), // Original Supabase user UUID for mapping
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("customer")
    ),
    clerkId: v.optional(v.string()), // Will be set when user signs in via Clerk
  },
  handler: async (ctx, args) => {
    // Check if user already exists by email
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existing) {
      // Update existing user
      await ctx.db.patch(existing._id, {
        name: args.name,
        role: args.role,
      });
      return { id: existing._id, supabaseUserId: args.supabaseUserId, created: false };
    }

    // Create new user
    const id = await ctx.db.insert("users", {
      clerkId: args.clerkId || "", // Will be set on first Clerk sign-in
      email: args.email,
      name: args.name,
      role: args.role,
    });

    return { id, supabaseUserId: args.supabaseUserId, created: true };
  },
});

// Import a user-company association
export const importUserCompany = mutation({
  args: {
    userConvexId: v.id("users"),
    companyConvexId: v.id("companies"),
  },
  handler: async (ctx, { userConvexId, companyConvexId }) => {
    // Check if association already exists
    const existing = await ctx.db
      .query("userCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userConvexId))
      .filter((q) => q.eq(q.field("companyId"), companyConvexId))
      .first();

    if (existing) {
      return { id: existing._id, created: false };
    }

    // Create new association
    const id = await ctx.db.insert("userCompanies", {
      userId: userConvexId,
      companyId: companyConvexId,
    });

    return { id, created: true };
  },
});

// Import domain assignment
export const importDomainAssignment = mutation({
  args: {
    domainName: v.string(),
    companyConvexId: v.id("companies"),
  },
  handler: async (ctx, { domainName, companyConvexId }) => {
    // Find domain by name
    const domain = await ctx.db
      .query("domains")
      .withIndex("by_name", (q) => q.eq("name", domainName))
      .first();

    if (!domain) {
      return { success: false, error: `Domain not found: ${domainName}` };
    }

    // Update domain with company assignment
    await ctx.db.patch(domain._id, { companyId: companyConvexId });

    return { success: true, domainId: domain._id };
  },
});

// Get all companies for mapping lookup
export const getAllCompanies = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("companies").collect();
  },
});

// Get all users for mapping lookup
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

// Clear all data (use with caution!)
export const clearAllData = mutation({
  args: {
    confirm: v.literal("I_UNDERSTAND_THIS_DELETES_EVERYTHING"),
  },
  handler: async (ctx) => {
    // Delete all user companies
    const userCompanies = await ctx.db.query("userCompanies").collect();
    for (const uc of userCompanies) {
      await ctx.db.delete(uc._id);
    }

    // Delete all users
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.delete(user._id);
    }

    // Delete all companies
    const companies = await ctx.db.query("companies").collect();
    for (const company of companies) {
      await ctx.db.delete(company._id);
    }

    // Delete all domains
    const domains = await ctx.db.query("domains").collect();
    for (const domain of domains) {
      await ctx.db.delete(domain._id);
    }

    // Delete all tickets
    const tickets = await ctx.db.query("tickets").collect();
    for (const ticket of tickets) {
      await ctx.db.delete(ticket._id);
    }

    // Delete all feedback
    const feedback = await ctx.db.query("feedback").collect();
    for (const fb of feedback) {
      await ctx.db.delete(fb._id);
    }

    // Delete all sync metadata
    const syncMetadata = await ctx.db.query("syncMetadata").collect();
    for (const sm of syncMetadata) {
      await ctx.db.delete(sm._id);
    }

    return {
      deleted: {
        userCompanies: userCompanies.length,
        users: users.length,
        companies: companies.length,
        domains: domains.length,
        tickets: tickets.length,
        feedback: feedback.length,
        syncMetadata: syncMetadata.length,
      },
    };
  },
});
