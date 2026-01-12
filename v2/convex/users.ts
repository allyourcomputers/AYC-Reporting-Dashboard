import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, requireSuperAdmin } from "./lib/auth";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Internal mutation to check if users exist (for bootstrap)
export const checkUsersExist = internalQuery({
  args: {},
  handler: async (ctx) => {
    const existingUsers = await ctx.db.query("users").first();
    return !!existingUsers;
  },
});

// Internal mutation to check if email exists
export const checkEmailExists = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    return !!existingUser;
  },
});

// Internal mutation to create company associations
export const createCompanyAssociations = internalMutation({
  args: {
    userId: v.id("users"),
    companyIds: v.array(v.id("companies")),
  },
  handler: async (ctx, { userId, companyIds }) => {
    for (const companyId of companyIds) {
      await ctx.db.insert("userCompanies", { userId, companyId });
    }
  },
});

/**
 * Bootstrap function to create the first super_admin user.
 * This only works if there are NO existing users in the database.
 * Run via CLI: npx convex run --prod users:bootstrap '{"email": "your@email.com", "name": "Your Name", "password": "initial-password"}'
 */
export const bootstrap = action({
  args: {
    email: v.string(),
    name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, name, password }) => {
    // Check if any users exist
    const usersExist = await ctx.runQuery(internal.users.checkUsersExist, {});
    if (usersExist) {
      throw new Error("Bootstrap failed: Users already exist. Use the admin interface to create new users.");
    }

    // Create the first super_admin user with Convex Auth
    const result = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: password },
      profile: {
        email,
        name,
        role: "super_admin" as const,
      },
      shouldLinkViaEmail: true,
    });

    return { userId: result.user._id, message: "Super admin created. Sign in with your email and password." };
  },
});

// Internal query for checking super_admin role (used by actions)
export const verifySuperAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);
    return true;
  },
});

// Internal query to list all users (for debugging)
export const listAllUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

// User CRUD operations

export const create = action({
  args: {
    email: v.string(),
    name: v.string(),
    password: v.string(),
    role: v.union(v.literal("super_admin"), v.literal("admin"), v.literal("customer")),
    companyIds: v.array(v.id("companies")),
  },
  handler: async (ctx, { email, name, password, role, companyIds }) => {
    // Verify super admin role
    await ctx.runQuery(internal.users.verifySuperAdmin, {});

    // Check if user with email already exists
    const emailExists = await ctx.runQuery(internal.users.checkEmailExists, { email });
    if (emailExists) {
      throw new Error("User with this email already exists");
    }

    // Create user with Convex Auth
    const result = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: password },
      profile: {
        email,
        name,
        role,
      },
      shouldLinkViaEmail: true,
    });

    const userId = result.user._id;

    // Create company associations
    if (companyIds.length > 0) {
      await ctx.runMutation(internal.users.createCompanyAssociations, { userId, companyIds });
    }

    return userId;
  },
});

export const update = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    role: v.union(v.literal("super_admin"), v.literal("admin"), v.literal("customer")),
    companyIds: v.array(v.id("companies")),
  },
  handler: async (ctx, { userId, name, role, companyIds }) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    // Update user
    await ctx.db.patch(userId, { name, role });

    // Delete existing company associations
    const existingAssocs = await ctx.db
      .query("userCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const assoc of existingAssocs) {
      await ctx.db.delete(assoc._id);
    }

    // Create new company associations
    for (const companyId of companyIds) {
      await ctx.db.insert("userCompanies", { userId, companyId });
    }

    return userId;
  },
});

export const remove = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    // Prevent deleting yourself
    const realUser = user.realUser ?? user;
    if (realUser._id === userId) {
      throw new Error("Cannot delete your own user account");
    }

    // Delete company associations
    const assocs = await ctx.db
      .query("userCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const assoc of assocs) {
      await ctx.db.delete(assoc._id);
    }

    // Delete user
    await ctx.db.delete(userId);
  },
});

export const getWithCompanies = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    const users = await ctx.db.query("users").collect();

    // Get company associations for each user
    const usersWithCompanies = await Promise.all(
      users.map(async (u) => {
        const assocs = await ctx.db
          .query("userCompanies")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .collect();
        const companies = await Promise.all(
          assocs.map((a) => ctx.db.get(a.companyId))
        );
        return {
          ...u,
          companies: companies.filter(Boolean),
        };
      })
    );

    return usersWithCompanies;
  },
});

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
