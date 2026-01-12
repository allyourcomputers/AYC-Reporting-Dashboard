import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

export type AuthenticatedUser = {
  _id: Id<"users">;
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
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db.get(userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Ensure required fields exist
  if (!user.email || !user.name || !user.role) {
    throw new Error("User profile incomplete. Please contact administrator.");
  }

  // Handle impersonation
  if (user.impersonatingUserId) {
    const impersonated = await ctx.db.get(user.impersonatingUserId);
    if (impersonated && impersonated.email && impersonated.name && impersonated.role) {
      return {
        _id: impersonated._id,
        email: impersonated.email,
        name: impersonated.name,
        role: impersonated.role,
        activeCompanyId: impersonated.activeCompanyId,
        impersonatingUserId: impersonated.impersonatingUserId,
        isImpersonating: true,
        realUser: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          activeCompanyId: user.activeCompanyId,
          impersonatingUserId: user.impersonatingUserId,
          isImpersonating: false,
          realUser: null,
        },
      };
    }
  }

  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    activeCompanyId: user.activeCompanyId,
    impersonatingUserId: user.impersonatingUserId,
    isImpersonating: false,
    realUser: null,
  };
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
