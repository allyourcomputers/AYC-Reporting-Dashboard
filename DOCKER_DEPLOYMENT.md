# Docker Deployment Guide (v2)

This guide explains how to deploy the HaloPSA Reporting Dashboard v2 using Docker.

## Prerequisites

- Docker installed (version 20.10+)
- Docker Compose installed (version 2.0+)
- Node.js 18+ (for Convex CLI)
- Convex account and project

## Architecture

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

The Docker container only serves the static frontend. All backend logic runs on Convex.

## Quick Start

### 1. Clone and Configure

```bash
git clone https://github.com/allyourcomputers/AYC-Reporting-Dashboard.git
cd AYC-Reporting-Dashboard/v2

# Create .env file
cp .env.production .env
```

### 2. Deploy with Script (Recommended)

```bash
./deploy.sh
```

The script automatically:
- Checks/generates Convex Auth environment variables
- Prompts for SITE_URL if not set
- Pulls latest code from GitHub
- Deploys Convex functions
- Builds Docker image
- Starts container
- Creates first admin user if needed

### 3. Access the Application

```
http://localhost:3200
```

## Manual Deployment

### Step 1: Set Convex Environment Variables

In Convex Dashboard > Settings > Environment Variables, set:

```
AUTH_SECRET=<generate with: openssl rand -base64 32>
JWT_PRIVATE_KEY=<generate with: openssl genpkey -algorithm RSA -pkcs8>
SITE_URL=https://your-production-domain.com

HALO_API_URL=https://your-halo.halopsa.com/api
HALO_CLIENT_ID=your_client_id
HALO_CLIENT_SECRET=your_client_secret

NINJA_CLIENT_ID=your_ninja_client_id
NINJA_CLIENT_SECRET=your_ninja_client_secret
NINJA_BASE_URL=https://app.ninjarmm.com

TWENTYI_API_KEY=your_20i_api_key
```

### Step 2: Deploy Convex Functions

```bash
npx convex deploy
```

### Step 3: Configure Frontend

Edit `.env`:

```env
VITE_CONVEX_URL=https://your-project.convex.cloud
PORT=3200
```

### Step 4: Build and Run

```bash
docker compose build
docker compose up -d
```

### Step 5: Create First Admin User

```bash
npx convex run users:bootstrap '{"email": "admin@example.com", "name": "Admin", "password": "SecurePassword123"}'
```

## Updating the Application

### Using deploy.sh (Recommended)

```bash
./deploy.sh
```

This handles everything: git pull, Convex deploy, Docker rebuild.

### Manual Update

```bash
# Pull latest code
git pull origin feature/react-convex-migration

# Deploy Convex functions
npx convex deploy

# Rebuild Docker
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Docker Compose Configuration

### docker-compose.yml

```yaml
services:
  halo-reporting-v2:
    build:
      context: .
      args:
        - VITE_CONVEX_URL=${VITE_CONVEX_URL}
    container_name: halo-reporting-v2
    ports:
      - "${PORT:-3200}:80"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Custom Port

```bash
# Option 1: Environment variable
PORT=8080 docker compose up -d

# Option 2: Edit .env
echo "PORT=8080" >> .env
docker compose up -d
```

## Behind Reverse Proxy (Nginx)

### docker-compose.yml for proxy setup

```yaml
services:
  halo-reporting-v2:
    ports:
      - "127.0.0.1:3200:80"  # Only bind to localhost
```

### Nginx configuration

```nginx
server {
    listen 80;
    server_name reports.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name reports.example.com;

    ssl_certificate /etc/letsencrypt/live/reports.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reports.example.com/privkey.pem;

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

## Docker Commands Reference

### Container Management

```bash
# View status
docker compose ps

# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Remove with volumes
docker compose down -v
```

### Debugging

```bash
# Shell into container
docker exec -it halo-reporting-v2 sh

# Check nginx config
docker exec halo-reporting-v2 nginx -t

# View nginx logs
docker exec halo-reporting-v2 cat /var/log/nginx/error.log
```

### Health Check

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' halo-reporting-v2

# Manual health check
curl http://localhost:3200/health
```

## Environment Variables Reference

### Frontend (.env file)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_CONVEX_URL` | Yes | - | Convex deployment URL |
| `PORT` | No | 3200 | Host port to expose |

### Convex Dashboard

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | Session encryption key |
| `JWT_PRIVATE_KEY` | Yes | RSA private key for JWT |
| `SITE_URL` | Yes | Production URL |
| `HALO_API_URL` | For HaloPSA | HaloPSA API endpoint |
| `HALO_CLIENT_ID` | For HaloPSA | HaloPSA OAuth client ID |
| `HALO_CLIENT_SECRET` | For HaloPSA | HaloPSA OAuth secret |
| `NINJA_CLIENT_ID` | For NinjaOne | NinjaOne client ID |
| `NINJA_CLIENT_SECRET` | For NinjaOne | NinjaOne client secret |
| `NINJA_BASE_URL` | For NinjaOne | NinjaOne API URL |
| `TWENTYI_API_KEY` | For 20i | 20i Reseller API key |

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs halo-reporting-v2

# Common issues:
# - .env file missing
# - Port already in use
# - VITE_CONVEX_URL not set
```

### Port already in use

```bash
# Find what's using the port
sudo lsof -i :3200

# Use a different port
PORT=3201 docker compose up -d
```

### Build fails

```bash
# Clear Docker cache
docker builder prune -a

# Rebuild from scratch
docker compose build --no-cache
```

### Sign-in not working

1. Check Convex Dashboard logs for errors
2. Verify environment variables are set:
   - `AUTH_SECRET`
   - `JWT_PRIVATE_KEY`
   - `SITE_URL`
3. Redeploy Convex: `npx convex deploy`

### Blank page after deployment

1. Check browser console for errors
2. Verify `VITE_CONVEX_URL` is correct
3. Check Convex deployment is active
4. Try hard refresh (Ctrl+Shift+R)

## Data Sync

Data sync runs on Convex scheduled functions, not in Docker:

| Sync | Schedule | Trigger Manually |
|------|----------|------------------|
| HaloPSA | Daily 2am UTC | `npx convex run sync/halopsa:syncTickets` |
| 20i | Daily 3am UTC | `npx convex run sync/twentyi:syncDomains` |

## Backup

The Docker container is stateless - all data is in Convex. For backup:

1. **Convex data**: Use Convex Dashboard export or snapshot features
2. **Docker image**: `docker save halo-reporting-v2 > backup.tar`
3. **Configuration**: Backup `.env` file (don't commit to git)

## Security Best Practices

1. **Never commit `.env`** - Contains deployment-specific values
2. **Use HTTPS** - Put behind Nginx with SSL
3. **Restrict ports** - Bind to localhost when using reverse proxy
4. **Keep updated** - Run `./deploy.sh` regularly for updates
5. **Rotate secrets** - Periodically rotate `AUTH_SECRET` and `JWT_PRIVATE_KEY`

## Next Steps

After deployment:

1. Create admin user (if not done by deploy.sh)
2. Configure API integrations in Convex Dashboard
3. Run initial data sync
4. Set up SSL with Let's Encrypt
5. Configure monitoring/alerting
