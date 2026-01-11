import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type AuthenticatedUser = {
  _id: Id<"users">;
  clerkId: string;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "customer";
  activeCompanyId?: Id<"companies">;
  impersonatingUserId?: Id<"users">;
  isImpersonating: boolean;
  realUser: AuthenticatedUser | null;
};

export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx
): Promise<AuthenticatedUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    throw new Error("User not found in database");
  }

  // Handle impersonation
  if (user.impersonatingUserId) {
    const impersonated = await ctx.db.get(user.impersonatingUserId);
    if (impersonated) {
      return {
        ...impersonated,
        isImpersonating: true,
        realUser: { ...user, isImpersonating: false, realUser: null },
      };
    }
  }

  return { ...user, isImpersonating: false, realUser: null };
}

export function getCompanyFilter(user: AuthenticatedUser): Id<"companies"> | null {
  // Super admins see all data unless they've selected a specific company
  if (user.role === "super_admin" && !user.activeCompanyId) {
    return null;
  }
  return user.activeCompanyId ?? null;
}

export function requireSuperAdmin(user: AuthenticatedUser): void {
  const realUser = user.realUser ?? user;
  if (realUser.role !== "super_admin") {
    throw new Error("Super admin access required");
  }
}

export function requireAdmin(user: AuthenticatedUser): void {
  const realUser = user.realUser ?? user;
  if (realUser.role !== "super_admin" && realUser.role !== "admin") {
    throw new Error("Admin access required");
  }
}
