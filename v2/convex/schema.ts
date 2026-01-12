import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  // Override the users table from authTables with our custom fields
  users: defineTable({
    // Convex Auth fields
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // App-specific fields
    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("customer")
    ),
    activeCompanyId: v.optional(v.id("companies")),
    impersonatingUserId: v.optional(v.id("users")),
    // Migration: keep clerkId for existing users during transition
    clerkId: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("by_clerk_id", ["clerkId"]),

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
    twentyiId: v.string(), // 20i domain ID
    name: v.string(),
    expiryDate: v.string(),
    status: v.union(v.literal("active"), v.literal("expiring-soon"), v.literal("expired")),
    hasHosting: v.boolean(),
    hostingPackageName: v.optional(v.string()),
    companyId: v.optional(v.id("companies")), // Link to company via domain assignment
  })
    .index("by_twentyi_id", ["twentyiId"])
    .index("by_name", ["name"])
    .index("by_company", ["companyId"]),

  feedback: defineTable({
    haloPsaId: v.number(), // HaloPSA feedback ID
    ticketId: v.optional(v.id("tickets")), // Optional - may not match an existing ticket
    haloPsaTicketId: v.number(), // HaloPSA ticket ID for reference
    score: v.optional(v.number()),
    scoreBand: v.optional(v.string()),
    date: v.optional(v.string()),
    comment: v.optional(v.string()),
  })
    .index("by_halopsa_id", ["haloPsaId"])
    .index("by_ticket", ["ticketId"]),

  syncMetadata: defineTable({
    syncType: v.string(), // "clients", "tickets", "feedback"
    lastSync: v.string(),
    recordsSynced: v.number(),
    status: v.union(v.literal("success"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
  })
    .index("by_sync_type", ["syncType"]),
});
