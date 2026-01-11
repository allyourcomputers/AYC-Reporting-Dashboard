import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("customer")
    ),
    activeCompanyId: v.optional(v.id("companies")),
    impersonatingUserId: v.optional(v.id("users")),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  companies: defineTable({
    name: v.string(),
    haloPsaClientId: v.optional(v.string()),
    logo: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_halopsa_id", ["haloPsaClientId"]),

  userCompanies: defineTable({
    userId: v.id("users"),
    companyId: v.id("companies"),
  })
    .index("by_user", ["userId"])
    .index("by_company", ["companyId"]),

  tickets: defineTable({
    companyId: v.id("companies"),
    haloPsaId: v.string(),
    summary: v.string(),
    status: v.string(),
    priority: v.optional(v.string()),
    category: v.optional(v.string()),
    dateCreated: v.number(),
    dateResolved: v.optional(v.number()),
    satisfaction: v.optional(v.number()),
  })
    .index("by_company", ["companyId"])
    .index("by_date", ["dateCreated"])
    .index("by_halopsa_id", ["haloPsaId"]),

  domains: defineTable({
    companyId: v.optional(v.id("companies")),
    name: v.string(),
    expiryDate: v.optional(v.number()),
    registrar: v.optional(v.string()),
    twentyiId: v.optional(v.string()),
  })
    .index("by_company", ["companyId"])
    .index("by_name", ["name"]),
});
