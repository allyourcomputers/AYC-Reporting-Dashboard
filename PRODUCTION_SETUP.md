# Production Deployment Setup (v2)

This guide covers production deployment for HaloPSA Reporting Dashboard v2 (React + Convex).

## Recommended: Docker Deployment

Docker is the recommended deployment method for v2. See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for complete instructions.

### Quick Start

```bash
cd v2
cp .env.production .env
./deploy.sh
```

The deploy script handles everything automatically.

## Architecture Overview

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

Key differences from v1:
- **No Express.js server** - Frontend is static files served by Nginx
- **No database on your server** - All data in Convex cloud
- **No cron jobs on server** - Convex handles scheduled functions
- **Simpler deployment** - Just static files + Convex functions

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for Convex CLI)
- Domain name with DNS configured
- SSL certificate (Let's Encrypt recommended)

## Step-by-Step Deployment

### 1. Clone Repository

```bash
git clone https://github.com/allyourcomputers/AYC-Reporting-Dashboard.git
cd AYC-Reporting-Dashboard/v2
```

### 2. Configure Environment

```bash
cp .env.production .env
nano .env
```

Set your Convex URL:
```env
VITE_CONVEX_URL=https://your-project.convex.cloud
PORT=3200
```

### 3. Run Deployment Script

```bash
./deploy.sh
```

On first run, the script will:
1. Generate and set `AUTH_SECRET` in Convex
2. Generate and set `JWT_PRIVATE_KEY` in Convex
3. Prompt for `SITE_URL` (your production URL)
4. Deploy Convex functions
5. Build Docker image
6. Start container
7. Prompt to create first admin user

### 4. Configure SSL (Nginx Reverse Proxy)

Install Nginx:
```bash
sudo apt install nginx
```

Create site configuration:
```bash
sudo nano /etc/nginx/sites-available/reports
```

```nginx
server {
    listen 80;
    server_name reports.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name reports.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/reports.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reports.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3200;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and get SSL:
```bash
sudo ln -s /etc/nginx/sites-available/reports /etc/nginx/sites-enabled/
sudo certbot --nginx -d reports.yourdomain.com
sudo systemctl reload nginx
```

### 5. Verify Deployment

```bash
# Check Docker container
docker compose ps

# Check health endpoint
curl http://localhost:3200/health

# Check HTTPS
curl https://reports.yourdomain.com
```

## Updating the Application

```bash
cd /path/to/AYC-Reporting-Dashboard/v2
./deploy.sh
```

The script automatically:
- Pulls latest code
- Deploys Convex functions
- Rebuilds Docker image
- Restarts container

## Convex Environment Variables

These must be set in **Convex Dashboard** (not on your server):

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | Session encryption |
| `JWT_PRIVATE_KEY` | Yes | JWT signing key |
| `SITE_URL` | Yes | Your production URL |
| `HALO_API_URL` | For HaloPSA | API endpoint |
| `HALO_CLIENT_ID` | For HaloPSA | OAuth client ID |
| `HALO_CLIENT_SECRET` | For HaloPSA | OAuth secret |
| `NINJA_CLIENT_ID` | For NinjaOne | API client ID |
| `NINJA_CLIENT_SECRET` | For NinjaOne | API secret |
| `NINJA_BASE_URL` | For NinjaOne | API URL |
| `TWENTYI_API_KEY` | For 20i | Reseller API key |

## Data Synchronization

Data sync runs automatically via Convex scheduled functions:

| Service | Schedule | Description |
|---------|----------|-------------|
| HaloPSA | Daily 2am UTC | Syncs tickets and clients |
| 20i | Daily 3am UTC | Syncs domain data |

Manual sync:
```bash
npx convex run sync/halopsa:syncTickets
npx convex run sync/twentyi:syncDomains
```

## Monitoring

### Docker Health

```bash
# Container status
docker compose ps

# Container logs
docker compose logs -f

# Resource usage
docker stats halo-reporting-v2
```

### Convex Dashboard

- View function logs
- Monitor database usage
- Check scheduled function execution
- View error rates

### Health Endpoint

```bash
curl http://localhost:3200/health
```

## Backup Strategy

All data is stored in Convex cloud. For backup:

1. **Convex data**: Use Convex Dashboard export features
2. **Configuration**: Backup your `.env` file securely
3. **Convex env vars**: Document them securely (they're in Dashboard)

## Security Checklist

- [ ] HTTPS enabled with valid SSL certificate
- [ ] Docker container not exposed directly (use reverse proxy)
- [ ] `AUTH_SECRET` is unique and secure
- [ ] `JWT_PRIVATE_KEY` is properly generated RSA key
- [ ] `.env` file not committed to git
- [ ] Firewall configured (only 80/443 exposed)
- [ ] Regular updates via `./deploy.sh`

## Troubleshooting

### Sign-in not working

1. Check Convex Dashboard logs
2. Verify all auth env vars are set:
   - `AUTH_SECRET`
   - `JWT_PRIVATE_KEY`
   - `SITE_URL`
3. Redeploy: `npx convex deploy`

### Container won't start

```bash
docker compose logs halo-reporting-v2
```

Common issues:
- Missing `.env` file
- Invalid `VITE_CONVEX_URL`
- Port conflict

### Blank page

1. Check browser console for errors
2. Verify `VITE_CONVEX_URL` points to correct Convex deployment
3. Check Convex deployment status in Dashboard

### API sync failing

1. Check Convex Dashboard function logs
2. Verify API credentials are set correctly
3. Test API connectivity from Convex functions

## Migration from v1

If upgrading from the Supabase version:

1. Deploy v2 alongside v1 (different port/subdomain)
2. Run data migration script: `v2/scripts/migrate-from-supabase.ts`
3. Create new user accounts (passwords don't migrate)
4. Test thoroughly
5. Switch DNS to v2
6. Decommission v1

---

## Legacy: PM2 Deployment (v1 Only)

The PM2 deployment method is for v1 (Supabase version) only. For v2, use Docker.

If you need to run v1, see the git history for the original PRODUCTION_SETUP.md content.
