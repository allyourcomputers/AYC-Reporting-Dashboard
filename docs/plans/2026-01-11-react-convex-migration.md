# React + Convex Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate HaloPSA Reporting Dashboard from vanilla JS + Supabase to React + Convex with Clerk auth.

**Architecture:** Vite-based React SPA with TypeScript, Convex for backend (queries, mutations, actions, scheduled sync), Clerk for authentication. Multi-tenant with company context, super admin impersonation preserved.

**Tech Stack:** Vite, React 18, TypeScript (strict), Convex, Clerk, shadcn/ui, Tailwind CSS, Recharts, React Router v6, jsPDF

---

## Phase 1: Project Foundation

### Task 1: Initialize Vite + React + TypeScript Project

**Files:**
- Create: `v2/package.json`
- Create: `v2/vite.config.ts`
- Create: `v2/tsconfig.json`
- Create: `v2/src/main.tsx`
- Create: `v2/index.html`

**Step 1: Create v2 directory and initialize project**

Run:
```bash
cd /Users/mjhorswood/Claude\ Code/halo-reporting/.worktrees/react-convex-migration
mkdir v2
cd v2
npm create vite@latest . -- --template react-ts
```

Expected: Project scaffolded with React + TypeScript template

**Step 2: Install core dependencies**

Run:
```bash
npm install react-router-dom@6 @tanstack/react-query
npm install -D @types/node
```

Expected: Dependencies added to package.json

**Step 3: Verify dev server starts**

Run:
```bash
npm run dev
```

Expected: Vite dev server running on http://localhost:5173

**Step 4: Commit**

```bash
git add v2/
git commit -m "feat: initialize Vite + React + TypeScript project"
```

---

### Task 2: Configure Tailwind CSS

**Files:**
- Create: `v2/tailwind.config.js`
- Create: `v2/postcss.config.js`
- Modify: `v2/src/index.css`

**Step 1: Install Tailwind and dependencies**

Run:
```bash
cd v2
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Expected: tailwind.config.js and postcss.config.js created

**Step 2: Configure Tailwind**

Replace `v2/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
```

**Step 3: Add Tailwind directives to CSS**

Replace `v2/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 4: Verify Tailwind works**

Update `v2/src/App.tsx`:
```tsx
function App() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary">
        Halo Reporting v2
      </h1>
      <p className="text-muted-foreground mt-2">
        Tailwind is working!
      </p>
    </div>
  )
}

export default App
```

Run: `npm run dev`
Expected: Page shows styled heading

**Step 5: Commit**

```bash
git add v2/
git commit -m "feat: configure Tailwind CSS with design tokens"
```

---

### Task 3: Set Up shadcn/ui

**Files:**
- Create: `v2/components.json`
- Create: `v2/src/lib/utils.ts`
- Create: `v2/src/components/ui/button.tsx`
- Create: `v2/src/components/ui/card.tsx`

**Step 1: Install shadcn/ui dependencies**

Run:
```bash
cd v2
npm install class-variance-authority clsx tailwind-merge lucide-react
npm install -D @types/node
```

**Step 2: Create utils**

Create `v2/src/lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 3: Create components.json**

Create `v2/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

**Step 4: Configure path aliases**

Update `v2/tsconfig.json` to add:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Update `v2/vite.config.ts`:
```typescript
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

**Step 5: Add Button component**

Create `v2/src/components/ui/button.tsx`:
```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

**Step 6: Install Radix Slot**

Run:
```bash
npm install @radix-ui/react-slot
```

**Step 7: Verify Button works**

Update `v2/src/App.tsx`:
```tsx
import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary">
        Halo Reporting v2
      </h1>
      <div className="mt-4 flex gap-2">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </div>
  )
}

export default App
```

Run: `npm run dev`
Expected: Three styled buttons visible

**Step 8: Commit**

```bash
git add v2/
git commit -m "feat: set up shadcn/ui with Button component"
```

---

### Task 4: Initialize Convex

**Files:**
- Create: `v2/convex/schema.ts`
- Create: `v2/convex/tsconfig.json`
- Modify: `v2/src/main.tsx`
- Create: `v2/.env.local`

**Step 1: Install Convex**

Run:
```bash
cd v2
npm install convex
```

**Step 2: Initialize Convex project**

Run:
```bash
npx convex dev --once
```

Expected: Prompts for Convex login, creates convex/ directory, generates `_generated/` files
Note: Follow prompts to create new Convex project named "halo-reporting-v2"

**Step 3: Create database schema**

Create `v2/convex/schema.ts`:
```typescript
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
```

**Step 4: Push schema to Convex**

Run:
```bash
npx convex dev --once
```

Expected: Schema deployed, tables created

**Step 5: Set up Convex provider in React**

Update `v2/src/main.tsx`:
```typescript
import React from "react"
import ReactDOM from "react-dom/client"
import { ConvexProvider, ConvexReactClient } from "convex/react"
import App from "./App.tsx"
import "./index.css"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>
)
```

**Step 6: Verify Convex connection**

Run: `npm run dev` in one terminal
Run: `npx convex dev` in another terminal

Expected: Both running without errors, Convex dashboard shows connected client

**Step 7: Commit**

```bash
git add v2/
git commit -m "feat: initialize Convex with database schema"
```

---

### Task 5: Set Up Clerk Authentication

**Files:**
- Modify: `v2/src/main.tsx`
- Create: `v2/convex/auth.config.ts`
- Create: `v2/src/components/auth/SignInPage.tsx`

**Step 1: Install Clerk**

Run:
```bash
cd v2
npm install @clerk/clerk-react
```

**Step 2: Create Clerk application**

Go to https://dashboard.clerk.com
Create new application named "Halo Reporting v2"
Copy Publishable Key

**Step 3: Add Clerk env vars**

Add to `v2/.env.local`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

**Step 4: Configure Clerk with Convex**

Create `v2/convex/auth.config.ts`:
```typescript
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
```

**Step 5: Set Clerk domain in Convex dashboard**

Run:
```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-domain.clerk.accounts.dev
```

Note: Get domain from Clerk dashboard > API Keys

**Step 6: Update main.tsx with Clerk + Convex**

Update `v2/src/main.tsx`:
```typescript
import React from "react"
import ReactDOM from "react-dom/client"
import { ClerkProvider, useAuth } from "@clerk/clerk-react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ConvexReactClient } from "convex/react"
import App from "./App.tsx"
import "./index.css"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </React.StrictMode>
)
```

**Step 7: Install Convex Clerk adapter**

Run:
```bash
npm install convex@latest
```

Note: ConvexProviderWithClerk is included in convex package

**Step 8: Create sign-in page**

Create `v2/src/components/auth/SignInPage.tsx`:
```typescript
import { SignIn } from "@clerk/clerk-react"

export function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          }
        }}
      />
    </div>
  )
}
```

**Step 9: Commit**

```bash
git add v2/
git commit -m "feat: set up Clerk authentication with Convex"
```

---

### Task 6: Set Up React Router

**Files:**
- Create: `v2/src/routes.tsx`
- Modify: `v2/src/App.tsx`
- Create: `v2/src/components/layout/ProtectedRoute.tsx`

**Step 1: Create protected route component**

Create `v2/src/components/layout/ProtectedRoute.tsx`:
```typescript
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react"
import { Outlet } from "react-router-dom"

export function ProtectedRoute() {
  return (
    <>
      <SignedIn>
        <Outlet />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
```

**Step 2: Create routes configuration**

Create `v2/src/routes.tsx`:
```typescript
import { createBrowserRouter } from "react-router-dom"
import { SignInPage } from "@/components/auth/SignInPage"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"

// Placeholder pages - will be implemented later
function DashboardPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Dashboard</h1></div>
}

function ReportsPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Reports</h1></div>
}

function ServersPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Servers</h1></div>
}

function WorkstationsPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Workstations</h1></div>
}

function DomainsPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Domains</h1></div>
}

function AdminUsersPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Admin Users</h1></div>
}

function AdminCompaniesPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Admin Companies</h1></div>
}

export const router = createBrowserRouter([
  {
    path: "/sign-in",
    element: <SignInPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/reports", element: <ReportsPage /> },
      { path: "/servers", element: <ServersPage /> },
      { path: "/servers/:deviceId", element: <div>Server Detail</div> },
      { path: "/workstations", element: <WorkstationsPage /> },
      { path: "/workstations/:deviceId", element: <div>Workstation Detail</div> },
      { path: "/domains", element: <DomainsPage /> },
      { path: "/admin/users", element: <AdminUsersPage /> },
      { path: "/admin/companies", element: <AdminCompaniesPage /> },
      { path: "/admin/domain-assignments", element: <div>Domain Assignments</div> },
    ],
  },
])
```

**Step 3: Update App.tsx to use router**

Update `v2/src/App.tsx`:
```typescript
import { RouterProvider } from "react-router-dom"
import { router } from "./routes"

function App() {
  return <RouterProvider router={router} />
}

export default App
```

**Step 4: Verify routing works**

Run: `npm run dev`
Navigate to: http://localhost:5173
Expected: Redirects to sign-in page

Sign in with Clerk
Expected: Redirects to dashboard

**Step 5: Commit**

```bash
git add v2/
git commit -m "feat: set up React Router with protected routes"
```

---

## Phase 2: Core Layout & Components

### Task 7: Create App Layout

**Files:**
- Create: `v2/src/components/layout/AppLayout.tsx`
- Create: `v2/src/components/layout/Header.tsx`
- Create: `v2/src/components/layout/Sidebar.tsx`
- Modify: `v2/src/routes.tsx`

**Step 1: Create Header component**

Create `v2/src/components/layout/Header.tsx`:
```typescript
import { UserButton } from "@clerk/clerk-react"

export function Header() {
  return (
    <header className="border-b bg-card">
      <div className="flex h-16 items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg">Halo Reporting</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </header>
  )
}
```

**Step 2: Create Sidebar component**

Create `v2/src/components/layout/Sidebar.tsx`:
```typescript
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FileText,
  Server,
  Monitor,
  Globe,
  Users,
  Building2,
} from "lucide-react"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/servers", icon: Server, label: "Servers" },
  { to: "/workstations", icon: Monitor, label: "Workstations" },
  { to: "/domains", icon: Globe, label: "Domains" },
]

const adminItems = [
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/companies", icon: Building2, label: "Companies" },
]

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card min-h-[calc(100vh-4rem)]">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )
            }
            end={item.to === "/"}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}

        <div className="pt-4">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
            Admin
          </p>
          {adminItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  )
}
```

**Step 3: Create AppLayout component**

Create `v2/src/components/layout/AppLayout.tsx`:
```typescript
import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

**Step 4: Update routes to use AppLayout**

Update `v2/src/routes.tsx` protected routes section:
```typescript
import { AppLayout } from "@/components/layout/AppLayout"

// ... in router config:
{
  element: <ProtectedRoute />,
  children: [
    {
      element: <AppLayout />,
      children: [
        { path: "/", element: <DashboardPage /> },
        { path: "/reports", element: <ReportsPage /> },
        // ... rest of routes
      ],
    },
  ],
},
```

**Step 5: Verify layout renders**

Run: `npm run dev`
Sign in
Expected: Dashboard shows with header and sidebar, navigation works

**Step 6: Commit**

```bash
git add v2/
git commit -m "feat: create app layout with header and sidebar"
```

---

### Task 8: Create Authorization Helper

**Files:**
- Create: `v2/convex/lib/auth.ts`
- Create: `v2/convex/users.ts`

**Step 1: Create auth helper**

Create `v2/convex/lib/auth.ts`:
```typescript
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

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
```

**Step 2: Create users queries**

Create `v2/convex/users.ts`:
```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, requireSuperAdmin } from "./lib/auth";

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
```

**Step 3: Push to Convex**

Run:
```bash
npx convex dev --once
```

Expected: Functions deployed successfully

**Step 4: Commit**

```bash
git add v2/
git commit -m "feat: create authorization helper and user queries"
```

---

### Task 9: Create Company Switcher Component

**Files:**
- Create: `v2/convex/companies.ts`
- Create: `v2/src/components/layout/CompanySwitcher.tsx`
- Create: `v2/src/components/layout/ImpersonationBanner.tsx`
- Modify: `v2/src/components/layout/Header.tsx`

**Step 1: Create companies queries**

Create `v2/convex/companies.ts`:
```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, requireSuperAdmin } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    if (user.role === "super_admin") {
      return await ctx.db.query("companies").collect();
    }

    // Get companies user belongs to
    const userCompanies = await ctx.db
      .query("userCompanies")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const companyIds = userCompanies.map((uc) => uc.companyId);
    const companies = await Promise.all(
      companyIds.map((id) => ctx.db.get(id))
    );

    return companies.filter(Boolean);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    haloPsaClientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    requireSuperAdmin(user);

    return await ctx.db.insert("companies", {
      ...args,
      isActive: true,
    });
  },
});
```

**Step 2: Install Select component dependencies**

Run:
```bash
cd v2
npm install @radix-ui/react-select
```

**Step 3: Create Select component**

Create `v2/src/components/ui/select.tsx`:
```typescript
import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80",
        position === "popper" && "translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
}
```

**Step 4: Create CompanySwitcher component**

Create `v2/src/components/layout/CompanySwitcher.tsx`:
```typescript
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function CompanySwitcher() {
  const user = useQuery(api.users.me)
  const companies = useQuery(api.companies.list)
  const switchCompany = useMutation(api.users.switchCompany)

  if (!user || user.role !== "super_admin") {
    return null
  }

  const handleChange = (value: string) => {
    if (value === "all") {
      switchCompany({ companyId: undefined })
    } else {
      switchCompany({ companyId: value as any })
    }
  }

  return (
    <Select
      value={user.activeCompanyId ?? "all"}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="All Companies" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Companies</SelectItem>
        {companies?.map((company) => (
          <SelectItem key={company._id} value={company._id}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

**Step 5: Create ImpersonationBanner component**

Create `v2/src/components/layout/ImpersonationBanner.tsx`:
```typescript
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export function ImpersonationBanner() {
  const user = useQuery(api.users.me)
  const stopImpersonation = useMutation(api.users.stopImpersonation)

  if (!user?.isImpersonating) {
    return null
  }

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          Viewing as: {user.name} ({user.email})
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => stopImpersonation()}
        className="bg-amber-600 border-amber-700 text-amber-950 hover:bg-amber-700"
      >
        Stop Impersonating
      </Button>
    </div>
  )
}
```

**Step 6: Update Header to include CompanySwitcher**

Update `v2/src/components/layout/Header.tsx`:
```typescript
import { UserButton } from "@clerk/clerk-react"
import { CompanySwitcher } from "./CompanySwitcher"

export function Header() {
  return (
    <header className="border-b bg-card">
      <div className="flex h-16 items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg">Halo Reporting</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <CompanySwitcher />
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </header>
  )
}
```

**Step 7: Update AppLayout to include ImpersonationBanner**

Update `v2/src/components/layout/AppLayout.tsx`:
```typescript
import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"
import { ImpersonationBanner } from "./ImpersonationBanner"

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
  )
}
```

**Step 8: Push Convex functions**

Run:
```bash
npx convex dev --once
```

**Step 9: Commit**

```bash
git add v2/
git commit -m "feat: add company switcher and impersonation banner"
```

---

## Phase 3: Dashboard Implementation

### Task 10: Create Dashboard Stats Queries

**Files:**
- Create: `v2/convex/dashboard.ts`
- Create: `v2/convex/tickets.ts`

**Step 1: Create tickets queries**

Create `v2/convex/tickets.ts`:
```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getCompanyFilter } from "./lib/auth";

export const list = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const user = await getAuthenticatedUser(ctx);
    const companyFilter = getCompanyFilter(user);

    let tickets = companyFilter
      ? await ctx.db
          .query("tickets")
          .withIndex("by_company", (q) => q.eq("companyId", companyFilter))
          .collect()
      : await ctx.db.query("tickets").collect();

    // Filter by date range if provided
    if (startDate) {
      tickets = tickets.filter((t) => t.dateCreated >= startDate);
    }
    if (endDate) {
      tickets = tickets.filter((t) => t.dateCreated <= endDate);
    }

    return tickets;
  },
});

export const stats = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const user = await getAuthenticatedUser(ctx);
    const companyFilter = getCompanyFilter(user);

    let tickets = companyFilter
      ? await ctx.db
          .query("tickets")
          .withIndex("by_company", (q) => q.eq("companyId", companyFilter))
          .collect()
      : await ctx.db.query("tickets").collect();

    // Filter by date range
    tickets = tickets.filter(
      (t) => t.dateCreated >= startDate && t.dateCreated <= endDate
    );

    const opened = tickets.length;
    const resolved = tickets.filter((t) => t.dateResolved).length;
    const avgSatisfaction =
      tickets.filter((t) => t.satisfaction).length > 0
        ? tickets
            .filter((t) => t.satisfaction)
            .reduce((sum, t) => sum + (t.satisfaction ?? 0), 0) /
          tickets.filter((t) => t.satisfaction).length
        : null;

    return {
      opened,
      resolved,
      avgSatisfaction,
      openRate: opened > 0 ? ((opened - resolved) / opened) * 100 : 0,
    };
  },
});
```

**Step 2: Create dashboard queries**

Create `v2/convex/dashboard.ts`:
```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getCompanyFilter } from "./lib/auth";

export const trends = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const user = await getAuthenticatedUser(ctx);
    const companyFilter = getCompanyFilter(user);

    let tickets = companyFilter
      ? await ctx.db
          .query("tickets")
          .withIndex("by_company", (q) => q.eq("companyId", companyFilter))
          .collect()
      : await ctx.db.query("tickets").collect();

    // Filter by date range
    tickets = tickets.filter(
      (t) => t.dateCreated >= startDate && t.dateCreated <= endDate
    );

    // Group by day
    const trendMap = new Map<string, { opened: number; resolved: number }>();

    for (const ticket of tickets) {
      const date = new Date(ticket.dateCreated).toISOString().split("T")[0];
      const current = trendMap.get(date) ?? { opened: 0, resolved: 0 };
      current.opened++;
      if (ticket.dateResolved) {
        current.resolved++;
      }
      trendMap.set(date, current);
    }

    return Array.from(trendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const topClients = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { startDate, endDate, limit = 5 }) => {
    const user = await getAuthenticatedUser(ctx);
    const companyFilter = getCompanyFilter(user);

    // Skip if user has a specific company selected
    if (companyFilter) {
      return [];
    }

    const tickets = await ctx.db.query("tickets").collect();
    const filteredTickets = tickets.filter(
      (t) => t.dateCreated >= startDate && t.dateCreated <= endDate
    );

    // Count by company
    const countMap = new Map<string, number>();
    for (const ticket of filteredTickets) {
      const count = countMap.get(ticket.companyId) ?? 0;
      countMap.set(ticket.companyId, count + 1);
    }

    // Get top companies
    const sorted = Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    // Fetch company names
    const results = await Promise.all(
      sorted.map(async ([companyId, ticketCount]) => {
        const company = await ctx.db.get(companyId as any);
        return {
          companyId,
          companyName: company?.name ?? "Unknown",
          ticketCount,
        };
      })
    );

    return results;
  },
});
```

**Step 3: Push to Convex**

Run:
```bash
npx convex dev --once
```

**Step 4: Commit**

```bash
git add v2/
git commit -m "feat: create dashboard and ticket queries"
```

---

### Task 11: Create Dashboard Page

**Files:**
- Create: `v2/src/components/ui/card.tsx`
- Create: `v2/src/components/dashboard/StatCard.tsx`
- Create: `v2/src/components/dashboard/TicketTrendsChart.tsx`
- Create: `v2/src/pages/DashboardPage.tsx`
- Modify: `v2/src/routes.tsx`

**Step 1: Install Recharts**

Run:
```bash
cd v2
npm install recharts
```

**Step 2: Create Card component**

Create `v2/src/components/ui/card.tsx`:
```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
```

**Step 3: Create StatCard component**

Create `v2/src/components/dashboard/StatCard.tsx`:
```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
}

export function StatCard({ title, value, description, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 4: Create TicketTrendsChart component**

Create `v2/src/components/dashboard/TicketTrendsChart.tsx`:
```typescript
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TrendData {
  date: string
  opened: number
  resolved: number
}

interface TicketTrendsChartProps {
  data: TrendData[]
}

export function TicketTrendsChart({ data }: TicketTrendsChartProps) {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Ticket Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })
              }
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) =>
                new Date(value).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="opened"
              stroke="#3b82f6"
              name="Opened"
            />
            <Line
              type="monotone"
              dataKey="resolved"
              stroke="#22c55e"
              name="Resolved"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

**Step 5: Create DashboardPage**

Create `v2/src/pages/DashboardPage.tsx`:
```typescript
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { StatCard } from "@/components/dashboard/StatCard"
import { TicketTrendsChart } from "@/components/dashboard/TicketTrendsChart"
import { Ticket, CheckCircle, ThumbsUp, AlertCircle } from "lucide-react"

export function DashboardPage() {
  // Last 30 days
  const endDate = Date.now()
  const startDate = endDate - 30 * 24 * 60 * 60 * 1000

  const stats = useQuery(api.tickets.stats, { startDate, endDate })
  const trends = useQuery(api.dashboard.trends, { startDate, endDate })
  const topClients = useQuery(api.dashboard.topClients, { startDate, endDate })

  if (!stats || !trends) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tickets Opened"
          value={stats.opened}
          description="Last 30 days"
          icon={Ticket}
        />
        <StatCard
          title="Tickets Resolved"
          value={stats.resolved}
          description="Last 30 days"
          icon={CheckCircle}
        />
        <StatCard
          title="Satisfaction"
          value={
            stats.avgSatisfaction
              ? `${stats.avgSatisfaction.toFixed(1)}%`
              : "N/A"
          }
          description="Average rating"
          icon={ThumbsUp}
        />
        <StatCard
          title="Open Rate"
          value={`${stats.openRate.toFixed(1)}%`}
          description="Currently open"
          icon={AlertCircle}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TicketTrendsChart data={trends} />

        {topClients && topClients.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-4">Top Clients</h3>
            <div className="space-y-3">
              {topClients.map((client, index) => (
                <div
                  key={client.companyId}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">
                    {index + 1}. {client.companyName}
                  </span>
                  <span className="text-sm font-medium">
                    {client.ticketCount} tickets
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 6: Update routes**

Update `v2/src/routes.tsx` to import DashboardPage:
```typescript
import { DashboardPage } from "@/pages/DashboardPage"

// In router children, replace placeholder:
{ path: "/", element: <DashboardPage /> },
```

**Step 7: Verify dashboard renders**

Run: `npm run dev`
Sign in
Expected: Dashboard shows with stat cards and chart (empty data until sync is set up)

**Step 8: Commit**

```bash
git add v2/
git commit -m "feat: implement dashboard page with stats and trends chart"
```

---

## Remaining Tasks (Summary)

The following tasks follow the same pattern. Each task should:
1. Create Convex queries/mutations as needed
2. Create React components
3. Verify functionality
4. Commit

### Phase 3 Continued
- **Task 12:** Create Reports Page with date filtering and PDF/CSV export
- **Task 13:** Create DateRangePicker component

### Phase 4: Admin Pages
- **Task 14:** Create Admin Users Page with CRUD operations
- **Task 15:** Create Admin Companies Page with CRUD operations
- **Task 16:** Create Domain Assignments Page

### Phase 5: Infrastructure Pages
- **Task 17:** Create NinjaOne integration actions
- **Task 18:** Create Servers Page with live data
- **Task 19:** Create Server Detail Page
- **Task 20:** Create Workstations Page
- **Task 21:** Create Domains Page with 20i data

### Phase 6: Sync Implementation
- **Task 22:** Create HaloPSA sync actions and scheduled functions
- **Task 23:** Create 20i sync actions and scheduled functions
- **Task 24:** Test sync functionality

### Phase 7: Data Migration
- **Task 25:** Create Supabase to Convex migration script
- **Task 26:** Create user migration (Supabase Auth to Clerk)
- **Task 27:** Run migration on test data
- **Task 28:** Verify data integrity

### Phase 8: Final Testing & Cutover
- **Task 29:** End-to-end testing of all features
- **Task 30:** Deploy to staging
- **Task 31:** User acceptance testing
- **Task 32:** Production cutover

---

## Environment Setup Checklist

Before starting implementation:

- [ ] Convex account created
- [ ] Convex project created (halo-reporting-v2)
- [ ] Clerk account created
- [ ] Clerk application created (Halo Reporting v2)
- [ ] Clerk JWT issuer domain added to Convex env vars
- [ ] HaloPSA API credentials available
- [ ] NinjaOne API credentials available
- [ ] 20i API credentials available
