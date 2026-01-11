import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, requireSuperAdmin } from "./lib/auth";

// User CRUD operations

export const create = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("super_admin"), v.literal("admin"), v.literal("customer")),
    companyIds: v.array(v.id("companies")),
  },
  handler: async (ctx, { email, name, role, companyIds }) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    // Check if user with email already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Create user (clerkId will be set when user signs in via Clerk)
    const userId = await ctx.db.insert("users", {
      clerkId: "", // Will be set on first Clerk sign-in
      email,
      name,
      role,
    });

    // Create company associations
    for (const companyId of companyIds) {
      await ctx.db.insert("userCompanies", { userId, companyId });
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
