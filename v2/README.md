# HaloPSA Reporting Dashboard v2

A modern React + Convex reporting dashboard for HaloPSA, NinjaOne, and 20i domain management.

## Features

- **Modern Stack** - React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Real-time Backend** - Convex for database, functions, and real-time sync
- **Built-in Authentication** - Convex Auth with email/password (no external providers)
- **Multi-tenant** - Role-based access (super_admin, admin, customer)
- **Impersonation** - Super admins can impersonate users for support
- **Company Switching** - Switch between assigned companies
- **PDF/CSV Export** - Download reports for offline analysis

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- Convex account (free at [convex.dev](https://convex.dev))

### Development Setup

```bash
# Install dependencies
npm install

# Start Convex dev server (runs migrations, watches for changes)
npx convex dev

# In another terminal, start Vite dev server
npm run dev
```

The app will be available at `http://localhost:5173`

### First-Time Setup

After starting the dev server, bootstrap the first admin user:

```bash
npx convex run users:bootstrap '{"email": "admin@example.com", "name": "Admin", "password": "SecurePassword123"}'
```

## Production Deployment

### Using Docker (Recommended)

The `deploy.sh` script handles everything automatically:

```bash
# First deployment - will prompt for SITE_URL and admin credentials
./deploy.sh

# Subsequent deployments - just pulls and rebuilds
./deploy.sh
```

The script automatically:
- Generates `AUTH_SECRET` and `JWT_PRIVATE_KEY` if not set
- Prompts for `SITE_URL` on first run
- Deploys Convex functions to production
- Rebuilds and starts Docker container
- Creates first admin user if database is empty

### Manual Deployment

1. **Set Convex environment variables** (Dashboard > Settings > Environment Variables):
   ```
   AUTH_SECRET=<openssl rand -base64 32>
   JWT_PRIVATE_KEY=<RSA PKCS#8 private key>
   SITE_URL=https://your-production-url.com
   ```

2. **Deploy Convex functions**:
   ```bash
   npx convex deploy
   ```

3. **Build and run Docker**:
   ```bash
   cp .env.production .env
   docker compose up -d
   ```

4. **Create first admin user**:
   ```bash
   npx convex run users:bootstrap '{"email": "admin@example.com", "name": "Admin", "password": "SecurePassword123"}'
   ```

## Environment Variables

### Frontend (.env file)

| Variable | Description |
|----------|-------------|
| `VITE_CONVEX_URL` | Convex deployment URL |
| `PORT` | Docker container port (default: 3200) |

### Convex Backend (Dashboard > Environment Variables)

| Variable | Description | How to Generate |
|----------|-------------|-----------------|
| `AUTH_SECRET` | Session encryption key | `openssl rand -base64 32` |
| `JWT_PRIVATE_KEY` | RSA key for JWT signing | `openssl genpkey -algorithm RSA -pkcs8` |
| `SITE_URL` | Production URL | Your domain (e.g., `https://reports.example.com`) |
| `HALO_API_URL` | HaloPSA API endpoint | From HaloPSA |
| `HALO_CLIENT_ID` | HaloPSA OAuth client ID | From HaloPSA |
| `HALO_CLIENT_SECRET` | HaloPSA OAuth secret | From HaloPSA |
| `NINJA_CLIENT_ID` | NinjaOne client ID | From NinjaOne |
| `NINJA_CLIENT_SECRET` | NinjaOne client secret | From NinjaOne |
| `NINJA_BASE_URL` | NinjaOne API URL | `https://app.ninjarmm.com` |
| `TWENTYI_API_KEY` | 20i API key | From 20i Reseller Panel |

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
│   ├── lib/                  # Utilities
│   └── main.tsx              # App entry point
├── convex/
│   ├── schema.ts             # Database schema
│   ├── auth.ts               # Convex Auth configuration
│   ├── auth.config.ts        # Auth provider config
│   ├── lib/auth.ts           # Authorization helpers
│   ├── users.ts              # User management
│   ├── companies.ts          # Company management
│   ├── tickets.ts            # Ticket queries
│   ├── sync/                 # Data sync functions
│   │   ├── halopsa.ts
│   │   └── twentyi.ts
│   └── crons.ts              # Scheduled functions
├── deploy.sh                 # Automated deployment script
├── docker-compose.yml        # Docker configuration
├── Dockerfile                # Container build
└── .env.production           # Production env template
```

## Authentication

### How It Works

- Uses **Convex Auth** with email/password authentication
- No external auth providers (Clerk, Auth0, etc.)
- Admins create users directly in the admin panel with initial passwords
- Users sign in immediately - no email verification required

### User Roles

| Role | Capabilities |
|------|--------------|
| `super_admin` | Full access, can impersonate users, manage all companies |
| `admin` | Manage assigned companies |
| `customer` | View data for assigned companies only |

### Creating Users

1. Sign in as super_admin
2. Go to Admin > Users
3. Click "Add User"
4. Enter email, name, password, role, and assign companies
5. User can sign in immediately with provided credentials

## Data Sync

Data is synchronized from external services on a schedule:

| Service | Frequency | Data |
|---------|-----------|------|
| HaloPSA | Daily 2am UTC | Tickets, clients |
| 20i | Daily 3am UTC | Domains |
| NinjaOne | Live | Servers, workstations (not cached) |

### Manual Sync

```bash
# Sync HaloPSA tickets
npx convex run sync/halopsa:syncTickets

# Sync 20i domains
npx convex run sync/twentyi:syncDomains
```

## Development

### Available Scripts

```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npx convex dev       # Start Convex dev server
npx convex deploy    # Deploy to production
```

### Adding UI Components

Using shadcn/ui:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add table
```

## Troubleshooting

### "Missing environment variable JWT_PRIVATE_KEY"

Generate and set an RSA PKCS#8 private key in Convex Dashboard:

```bash
openssl genpkey -algorithm RSA -pkcs8 2>/dev/null
```

Copy the entire output (including BEGIN/END markers) to Convex Dashboard.

### "pkcs8 must be PKCS#8 formatted string"

The JWT_PRIVATE_KEY must be a proper RSA key, not a random string. Use the command above.

### Sign-in not working after deployment

1. Verify all three auth env vars are set in Convex Dashboard:
   - `AUTH_SECRET`
   - `JWT_PRIVATE_KEY`
   - `SITE_URL`
2. Redeploy Convex functions: `npx convex deploy`
3. Check for errors in Convex Dashboard logs

### Docker container won't start

```bash
# Check logs
docker compose logs -f

# Verify .env exists
cat .env

# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

## License

ISC
