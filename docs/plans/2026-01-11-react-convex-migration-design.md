# React + Convex Migration Design

## Overview

Migration of HaloPSA Reporting Dashboard from vanilla JavaScript + Supabase to React + Convex.

**Motivation:** Improved developer experience - modern workflow with hot reloading, component-based architecture, TypeScript, and better tooling.

**Approach:** Parallel build - new React app developed alongside existing site, cutover when complete.

---

## Technology Stack

| Layer | Current | New |
|-------|---------|-----|
| Frontend | Vanilla JS, HTML | Vite + React 18 + TypeScript (strict) |
| Backend | Express.js | Convex |
| Database | Supabase (PostgreSQL) | Convex |
| Auth | Supabase Auth | Clerk |
| UI | Custom CSS | shadcn/ui + Tailwind CSS |
| Charts | Chart.js | Recharts |
| Export | jsPDF | jsPDF (same) |

---

## Project Structure

```
halo-reporting-v2/
├── src/
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Header, Sidebar, AppLayout
│   │   ├── charts/           # Recharts wrappers
│   │   └── features/         # Feature-specific components
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── ServersPage.tsx
│   │   ├── ServerDetailPage.tsx
│   │   ├── WorkstationsPage.tsx
│   │   ├── DomainsPage.tsx
│   │   └── admin/
│   │       ├── UsersPage.tsx
│   │       ├── CompaniesPage.tsx
│   │       └── DomainAssignmentPage.tsx
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utilities (export, helpers)
│   └── main.tsx
├── convex/
│   ├── schema.ts             # Database schema
│   ├── auth.ts               # Clerk integration
│   ├── lib/
│   │   └── auth.ts           # Authorization helpers
│   ├── users.ts
│   ├── companies.ts
│   ├── tickets.ts
│   ├── reports.ts
│   ├── integrations/
│   │   └── ninjaone.ts       # Live API calls
│   ├── sync/
│   │   ├── halopsa.ts        # HaloPSA sync
│   │   └── twentyi.ts        # 20i sync
│   └── crons.ts              # Scheduled functions
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## Database Schema

```typescript
// convex/schema.ts
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
  }),

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

  // NinjaOne data fetched live, not stored
});
```

---

## Authentication & Multi-Tenancy

### Clerk Integration

```typescript
// src/main.tsx
import { ClerkProvider } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <App />
    </ConvexProviderWithClerk>
  </ClerkProvider>
);
```

### Authorization Helper

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx } from "./_generated/server";

export async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) throw new Error("User not found");

  // Handle impersonation
  if (user.impersonatingUserId) {
    const impersonated = await ctx.db.get(user.impersonatingUserId);
    if (impersonated) {
      return { ...impersonated, realUser: user, isImpersonating: true };
    }
  }

  return { ...user, isImpersonating: false, realUser: null };
}

export function getCompanyFilter(user: AuthenticatedUser) {
  // Super admins see all unless they've selected a company
  if (user.role === "super_admin" && !user.activeCompanyId) {
    return null; // No filter
  }
  return user.activeCompanyId;
}

export function requireSuperAdmin(user: AuthenticatedUser) {
  const realUser = user.realUser ?? user;
  if (realUser.role !== "super_admin") {
    throw new Error("Super admin required");
  }
}
```

### Protected Query Example

```typescript
// convex/tickets.ts
import { query } from "./_generated/server";
import { getAuthenticatedUser, getCompanyFilter } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const companyFilter = getCompanyFilter(user);

    if (companyFilter) {
      return await ctx.db
        .query("tickets")
        .withIndex("by_company", (q) => q.eq("companyId", companyFilter))
        .collect();
    }

    return await ctx.db.query("tickets").collect();
  },
});
```

---

## External API Integrations

### Strategy

| Service | Approach | Reason |
|---------|----------|--------|
| HaloPSA | Convex scheduled sync | Periodic bulk sync, cache in Convex |
| 20i | Convex scheduled sync | Periodic domain data refresh |
| NinjaOne | Live API calls | Real-time data required |

### HaloPSA Sync

```typescript
// convex/sync/halopsa.ts
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

export const syncTickets = internalAction({
  handler: async (ctx) => {
    const token = await getHaloPsaToken();
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${process.env.HALO_API_URL}/tickets?page=${page}&pageSize=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();

      await ctx.runMutation(internal.sync.halopsa.upsertTickets, {
        tickets: data.tickets,
      });

      hasMore = data.tickets.length === 100;
      page++;
    }
  },
});

export const upsertTickets = internalMutation({
  args: { tickets: v.array(v.any()) },
  handler: async (ctx, { tickets }) => {
    for (const ticket of tickets) {
      const existing = await ctx.db
        .query("tickets")
        .withIndex("by_halopsa_id", (q) => q.eq("haloPsaId", String(ticket.id)))
        .unique();

      const ticketData = {
        haloPsaId: String(ticket.id),
        summary: ticket.summary,
        status: ticket.status,
        dateCreated: new Date(ticket.dateCreated).getTime(),
        dateResolved: ticket.dateResolved
          ? new Date(ticket.dateResolved).getTime()
          : undefined,
        companyId: await resolveCompanyId(ctx, ticket.clientId),
      };

      if (existing) {
        await ctx.db.patch(existing._id, ticketData);
      } else {
        await ctx.db.insert("tickets", ticketData);
      }
    }
  },
});
```

### Scheduled Functions

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "sync halopsa tickets",
  { hourUTC: 2, minuteUTC: 0 },
  internal.sync.halopsa.syncTickets
);

crons.daily(
  "sync 20i domains",
  { hourUTC: 3, minuteUTC: 0 },
  internal.sync.twentyi.syncDomains
);

export default crons;
```

### NinjaOne Live Data

```typescript
// convex/integrations/ninjaone.ts
import { action } from "../_generated/server";
import { getAuthenticatedUser, getCompanyFilter } from "./lib/auth";

export const getServers = action({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const token = await getNinjaOneToken();
    const response = await fetch(
      `${process.env.NINJAONE_API_URL}/v2/devices?df=class eq SERVER`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const devices = await response.json();

    // Filter by company if needed
    const companyFilter = getCompanyFilter(user);
    if (companyFilter) {
      return filterDevicesByCompany(devices, companyFilter);
    }

    return devices;
  },
});

export const getServerDetails = action({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    await getAuthenticatedUser(ctx); // Auth check

    const token = await getNinjaOneToken();
    const response = await fetch(
      `${process.env.NINJAONE_API_URL}/v2/device/${deviceId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return await response.json();
  },
});
```

---

## UI Components

### Layout

```typescript
// src/components/layout/AppLayout.tsx
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { ImpersonationBanner } from "./ImpersonationBanner";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <ImpersonationBanner />
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### Key Components

| Component | Source | Purpose |
|-----------|--------|---------|
| `Button`, `Card`, `Table` | shadcn/ui | Base UI components |
| `DataTable` | shadcn/ui | Sortable, filterable tables |
| `CompanySwitcher` | Custom | Company dropdown for super admins |
| `ImpersonationBanner` | Custom | Warning when impersonating |
| `StatCard` | Custom | Dashboard metric cards |
| `DateRangePicker` | shadcn/ui | Report date filtering |
| `LineChart`, `BarChart` | Recharts | Dashboard visualizations |

### Routing

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignIn, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<SignIn />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/servers" element={<ServersPage />} />
            <Route path="/servers/:deviceId" element={<ServerDetailPage />} />
            <Route path="/workstations" element={<WorkstationsPage />} />
            <Route path="/workstations/:deviceId" element={<WorkstationDetailPage />} />
            <Route path="/domains" element={<DomainsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/companies" element={<AdminCompaniesPage />} />
            <Route path="/admin/domain-assignments" element={<AdminDomainAssignmentPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function ProtectedRoute() {
  return (
    <>
      <SignedIn>
        <Outlet />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
```

---

## Reports & Export

```typescript
// src/lib/export.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReportRow {
  month: string;
  opened: number;
  resolved: number;
  satisfaction: number;
}

export function exportPDF(data: ReportRow[], title: string) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(title, 14, 22);

  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

  autoTable(doc, {
    startY: 40,
    head: [["Month", "Opened", "Resolved", "Satisfaction %"]],
    body: data.map((row) => [
      row.month,
      row.opened.toString(),
      row.resolved.toString(),
      `${row.satisfaction}%`,
    ]),
  });

  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

export function exportCSV(data: ReportRow[], filename: string) {
  const headers = ["Month", "Opened", "Resolved", "Satisfaction"];
  const rows = data.map((row) => [
    row.month,
    row.opened,
    row.resolved,
    row.satisfaction,
  ]);

  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## Migration Strategy

### Phase 1: Foundation
- [ ] Create `halo-reporting-v2` directory
- [ ] Initialize Vite + React + TypeScript project
- [ ] Configure Tailwind CSS
- [ ] Set up Convex project and schema
- [ ] Configure Clerk authentication
- [ ] Build AppLayout, Header, Sidebar components
- [ ] Set up React Router

### Phase 2: Core Features
- [ ] Dashboard page with stats cards
- [ ] Recharts integration for ticket trends
- [ ] Reports page with date filtering
- [ ] PDF/CSV export functionality
- [ ] Company switcher component
- [ ] Impersonation banner and controls

### Phase 3: Admin & Infrastructure
- [ ] Admin users page (CRUD)
- [ ] Admin companies page (CRUD)
- [ ] Domain assignment page
- [ ] Servers page (NinjaOne live)
- [ ] Server detail page
- [ ] Workstations page
- [ ] Domains page

### Phase 4: Sync & Data Migration
- [ ] HaloPSA sync in Convex
- [ ] 20i sync in Convex
- [ ] Migration script: Supabase → Convex
- [ ] User migration: Supabase Auth → Clerk
- [ ] Testing with production data copy

### Phase 5: Cutover
- [ ] Deploy to staging subdomain
- [ ] User acceptance testing
- [ ] DNS switch to production
- [ ] Decommission old site

---

## Environment Variables

```env
# Convex
VITE_CONVEX_URL=https://your-project.convex.cloud

# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# HaloPSA (Convex environment)
HALO_API_URL=https://your-domain.halopsa.com/api
HALO_CLIENT_ID=...
HALO_CLIENT_SECRET=...

# NinjaOne (Convex environment)
NINJAONE_API_URL=https://app.ninjarmm.com
NINJAONE_CLIENT_ID=...
NINJAONE_CLIENT_SECRET=...

# 20i (Convex environment)
TWENTYI_API_KEY=...
```

---

## Deployment

**Frontend:** Vercel (recommended) or any static host
- Automatic deploys from Git
- Preview deployments for PRs

**Backend:** Convex (automatic)
- Deploys on `npx convex deploy`
- Environment variables in Convex dashboard

**Development:**
```bash
# Terminal 1: Vite dev server
npm run dev

# Terminal 2: Convex dev
npx convex dev
```
