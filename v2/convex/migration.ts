import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Migration utilities for importing data from Supabase
 * Note: These mutations are public during migration, remove after migration is complete
 */

// Clean up orphaned auth data (sessions, refresh tokens, and auth accounts for non-existent users)
export const cleanupOrphanedAuthData = mutation({
  args: {},
  handler: async (ctx) => {
    const stats = {
      sessions: 0,
      refreshTokens: 0,
      authAccounts: 0,
    };

    // Get all valid user IDs
    const users = await ctx.db.query("users").collect();
    const validUserIds = new Set(users.map((u) => u._id));

    // Clean up authSessions for non-existent users
    const sessions = await ctx.db.query("authSessions").collect();
    for (const session of sessions) {
      if (!validUserIds.has(session.userId as any)) {
        await ctx.db.delete(session._id);
        stats.sessions++;
      }
    }

    // Clean up authRefreshTokens for deleted sessions
    const remainingSessions = await ctx.db.query("authSessions").collect();
    const validSessionIds = new Set(remainingSessions.map((s) => s._id));
    const refreshTokens = await ctx.db.query("authRefreshTokens").collect();
    for (const token of refreshTokens) {
      if (!validSessionIds.has(token.sessionId as any)) {
        await ctx.db.delete(token._id);
        stats.refreshTokens++;
      }
    }

    // Clean up authAccounts for non-existent users
    const accounts = await ctx.db.query("authAccounts").collect();
    for (const account of accounts) {
      if (!validUserIds.has(account.userId as any)) {
        await ctx.db.delete(account._id);
        stats.authAccounts++;
      }
    }

    return stats;
  },
});

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
      .withIndex("email", (q) => q.eq("email", args.email))
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

// Delete a specific user by email (for migration cleanup)
export const deleteUserByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .unique();

    if (!user) {
      return { success: false, message: `No user found with email: ${email}` };
    }

    // Delete user's company associations
    const userCompanies = await ctx.db
      .query("userCompanies")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const uc of userCompanies) {
      await ctx.db.delete(uc._id);
    }

    // Delete user
    await ctx.db.delete(user._id);
    return { success: true, message: `Deleted user: ${email}` };
  },
});

// Delete all users (keeps companies and other data)
export const deleteAllUsers = mutation({
  args: {
    confirm: v.literal("DELETE_ALL_USERS"),
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

    return { deleted: users.length };
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

// Clear only auth-related data (for fixing orphaned auth records)
export const clearAuthData = mutation({
  args: {
    confirm: v.literal("DELETE_AUTH_DATA"),
  },
  handler: async (ctx) => {
    const stats = {
      authSessions: 0,
      authRefreshTokens: 0,
      authAccounts: 0,
    };

    // Delete all auth sessions
    const sessions = await ctx.db.query("authSessions").collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
      stats.authSessions++;
    }

    // Delete all refresh tokens
    const refreshTokens = await ctx.db.query("authRefreshTokens").collect();
    for (const token of refreshTokens) {
      await ctx.db.delete(token._id);
      stats.authRefreshTokens++;
    }

    // Delete all auth accounts
    const accounts = await ctx.db.query("authAccounts").collect();
    for (const account of accounts) {
      await ctx.db.delete(account._id);
      stats.authAccounts++;
    }

    return stats;
  },
});
