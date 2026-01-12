# React + Convex Migration Design

## Overview

Migration of HaloPSA Reporting Dashboard from vanilla JavaScript + Supabase to React + Convex.

**Motivation:** Improved developer experience - modern workflow with hot reloading, component-based architecture, TypeScript, and better tooling.

**Approach:** Parallel build - new React app developed alongside existing site, cutover when complete.

**Status:** ✅ Complete

---

## Technology Stack

| Layer | Current | New |
|-------|---------|-----|
| Frontend | Vanilla JS, HTML | Vite + React 18 + TypeScript (strict) |
| Backend | Express.js | Convex |
| Database | Supabase (PostgreSQL) | Convex |
| Auth | Supabase Auth | **Convex Auth** (email/password) |
| UI | Custom CSS | shadcn/ui + Tailwind CSS |
| Charts | Chart.js | Recharts |
| Export | jsPDF | jsPDF (same) |

---

## Project Structure

```
v2/
├── src/
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Header, Sidebar, ProtectedRoute
│   │   ├── auth/             # SignInPage
│   │   └── charts/           # Recharts wrappers
│   ├── pages/                # Route pages
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utilities (export, helpers)
│   └── main.tsx
├── convex/
│   ├── schema.ts             # Database schema
│   ├── auth.ts               # Convex Auth configuration
│   ├── auth.config.ts        # Auth provider config
│   ├── lib/
│   │   └── auth.ts           # Authorization helpers
│   ├── users.ts              # User management
│   ├── companies.ts          # Company queries/mutations
│   ├── tickets.ts            # Ticket queries
│   ├── sync/
│   │   ├── halopsa.ts        # HaloPSA sync
│   │   └── twentyi.ts        # 20i sync
│   └── crons.ts              # Scheduled functions
├── deploy.sh                 # Automated deployment script
├── docker-compose.yml        # Docker configuration
├── Dockerfile                # Container build
└── .env.production           # Production env template
```

---

## Database Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,  // Auth tables from Convex Auth

  users: defineTable({
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
});
```

---

## Authentication (Convex Auth)

### Why Convex Auth Instead of Clerk?

**Problem with Clerk:** Required creating users in two places (Clerk dashboard + Convex database) and linking them via email. Complex onboarding flow.

**Solution:** Convex Auth with Password provider allows admins to create users directly in the Convex database with initial passwords. Single source of truth.

### Configuration

```typescript
// convex/auth.ts
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
});
```

```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

### Required Environment Variables

Set in Convex Dashboard > Settings > Environment Variables:

| Variable | Description | How to Generate |
|----------|-------------|-----------------|
| `AUTH_SECRET` | Session encryption key | `openssl rand -base64 32` |
| `JWT_PRIVATE_KEY` | RSA private key for JWT signing | `openssl genpkey -algorithm RSA -pkcs8` |
| `SITE_URL` | Production URL | e.g., `https://reports.example.com` |

### Authorization Helper

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const authId = await getAuthUserId(ctx);
  if (!authId) throw new Error("Not authenticated");

  // Find user by email from auth session
  const authSession = await ctx.db.get(authId);
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", authSession?.email))
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
```

### Frontend Provider

```typescript
// src/main.tsx
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <App />
  </ConvexAuthProvider>
);
```

### Sign-In Component

```typescript
// src/components/auth/SignInPage.tsx
import { useAuthActions } from "@convex-dev/auth/react";

export function SignInPage() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await signIn("password", { email, password, flow: "signIn" });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">Sign In</button>
    </form>
  );
}
```

---

## External API Integrations

### Strategy

| Service | Approach | Reason |
|---------|----------|--------|
| HaloPSA | Convex scheduled sync | Periodic bulk sync, cache in Convex |
| 20i | Convex scheduled sync | Periodic domain data refresh |
| NinjaOne | Live API calls | Real-time data required |

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

---

## Deployment

### Automated Deployment Script

The `deploy.sh` script handles everything:

1. Generates `AUTH_SECRET` if not set
2. Generates `JWT_PRIVATE_KEY` (RSA PKCS#8) if not set
3. Prompts for `SITE_URL` on first run
4. Pulls latest code from GitHub
5. Deploys Convex functions
6. Rebuilds Docker container
7. Creates first admin user if database is empty

```bash
./deploy.sh
```

### Docker Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Host                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │            halo-reporting-v2 container           │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │         Nginx (static files)            │    │   │
│  │  │         React SPA (Vite build)          │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
│                           │                              │
│                           ▼                              │
│                    Port 3200 (configurable)              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │      Convex Cloud           │
              │  - Database                 │
              │  - Backend functions        │
              │  - Real-time subscriptions  │
              │  - Authentication           │
              └─────────────────────────────┘
```

### Environment Variables

**Frontend (.env file):**
```env
VITE_CONVEX_URL=https://your-project.convex.cloud
PORT=3200
```

**Convex Backend (Dashboard > Environment Variables):**
```
AUTH_SECRET=<generated>
JWT_PRIVATE_KEY=<RSA PKCS#8 key>
SITE_URL=https://your-production-url.com

HALO_API_URL=https://your-domain.halopsa.com/api
HALO_CLIENT_ID=...
HALO_CLIENT_SECRET=...

NINJA_CLIENT_ID=...
NINJA_CLIENT_SECRET=...
NINJA_BASE_URL=https://app.ninjarmm.com

TWENTYI_API_KEY=...
```

---

## Migration Phases (Completed)

### Phase 1: Foundation ✅
- Created `v2` directory with Vite + React + TypeScript
- Configured Tailwind CSS and shadcn/ui
- Set up Convex project and schema
- Configured **Convex Auth** (not Clerk as originally planned)
- Built AppLayout, Header, Sidebar components
- Set up React Router

### Phase 2: Core Features ✅
- Dashboard page with stats cards
- Recharts integration for ticket trends
- Reports page with date filtering
- PDF/CSV export functionality
- Company switcher component
- Impersonation banner and controls

### Phase 3: Admin & Infrastructure ✅
- Admin users page (CRUD)
- Admin companies page (CRUD)
- Domain assignment page
- Servers page (NinjaOne live)
- Server detail page
- Workstations page
- Domains page

### Phase 4: Sync & Data Migration ✅
- HaloPSA sync in Convex
- 20i sync in Convex
- Migration script: Supabase → Convex
- User creation via admin panel (no migration needed)

### Phase 5: Deployment ✅
- Docker deployment with automated `deploy.sh`
- SSL configuration via Nginx reverse proxy
- Production documentation updated
