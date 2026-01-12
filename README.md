# HaloPSA Reporting Dashboard

A web-based reporting dashboard for HaloPSA, NinjaOne, and 20i domain management.

## Versions

### v2 (Current) - React + Convex

The current version uses a modern React frontend with Convex for the backend:

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Convex (database, functions, real-time sync)
- **Authentication:** Convex Auth (email/password, no external providers)
- **Deployment:** Docker container + Convex cloud

**Quick Start:**
```bash
cd v2
./deploy.sh
```

See [v2/README.md](v2/README.md) for complete documentation.

### v1 (Legacy) - Express + Supabase

The original version uses vanilla JavaScript with Supabase:

- **Frontend:** Vanilla JS, HTML, CSS
- **Backend:** Express.js, Supabase (PostgreSQL)
- **Authentication:** Supabase Auth

This version is deprecated but still available in the repository root.

---

## Features

- **Multi-tenant** - Role-based access (super_admin, admin, customer)
- **Company Management** - Assign users to multiple companies
- **Impersonation** - Super admins can impersonate users for support
- **Ticket Statistics** - View and export ticket metrics
- **Domain Management** - Track domain expiry dates (20i integration)
- **Server Monitoring** - Real-time NinjaOne device data
- **PDF/CSV Export** - Download reports for offline analysis

## Architecture (v2)

```
┌─────────────────────────────────────┐
│           Your Server               │
│  ┌───────────────────────────────┐  │
│  │   Docker Container            │  │
│  │   (Nginx + Static React)      │  │
│  │   Port 3200                   │  │
│  └───────────────────────────────┘  │
│              │                       │
│              ▼                       │
│  ┌───────────────────────────────┐  │
│  │   Nginx Reverse Proxy         │  │
│  │   (SSL termination)           │  │
│  │   Port 443                    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│         Convex Cloud                │
│  - Database                         │
│  - Backend functions                │
│  - Authentication                   │
│  - Scheduled sync jobs              │
└─────────────────────────────────────┘
```

## Documentation

| Document | Description |
|----------|-------------|
| [v2/README.md](v2/README.md) | v2 Quick start and development |
| [AUTH_SETUP.md](AUTH_SETUP.md) | Authentication setup (Convex Auth) |
| [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) | Docker deployment guide |
| [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md) | Production deployment |

## License

ISC
