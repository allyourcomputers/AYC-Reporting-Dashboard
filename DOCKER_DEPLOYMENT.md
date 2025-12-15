# Docker Deployment Guide

This guide explains how to build and deploy the HaloPSA Reporting Dashboard using Docker.

## Prerequisites

- Docker installed (version 20.10+)
- Docker Compose installed (version 2.0+)
- `.env` file configured with your credentials

## Quick Start

### 1. Configure Environment

Make sure your `.env` file is configured:

```bash
cp .env.example .env
nano .env
```

**Important for Docker deployment:**
- Set `SUPABASE_URL` to your publicly accessible Supabase URL (e.g., `http://yourdomain.com:8000`)
- Set `PORT=3100` (this is internal to the container)
- **Note:** Port 3100 is used to avoid conflicts with Supabase, which typically runs on port 3000

### 2. Build and Run with Docker Compose

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

The application will be available at `http://localhost:3100`

### 3. Deploy on Custom Port

To run on port 80:

```bash
# Edit docker-compose.yml or set environment variable
export PORT=80
docker-compose up -d
```

Or edit `docker-compose.yml`:
```yaml
ports:
  - "80:3100"
```

## Manual Docker Build

If you prefer to use Docker directly without docker-compose:

### Build the Image

```bash
docker build -t halo-reporting:latest .
```

### Run the Container

```bash
docker run -d \
  --name halo-reporting \
  -p 3000:3100 \
  --env-file .env \
  --restart unless-stopped \
  halo-reporting:latest
```

### Run on Port 80

```bash
docker run -d \
  --name halo-reporting \
  -p 80:3100 \
  --env-file .env \
  --restart unless-stopped \
  halo-reporting:latest
```

## Docker Commands

### Container Management

```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View logs
docker logs halo-reporting

# Follow logs in real-time
docker logs -f halo-reporting

# Stop container
docker stop halo-reporting

# Start container
docker start halo-reporting

# Restart container
docker restart halo-reporting

# Remove container
docker rm halo-reporting

# Remove container (force)
docker rm -f halo-reporting
```

### Image Management

```bash
# List images
docker images

# Remove image
docker rmi halo-reporting:latest

# Build with no cache
docker build --no-cache -t halo-reporting:latest .

# Tag image for registry
docker tag halo-reporting:latest registry.example.com/halo-reporting:latest
```

### Debugging

```bash
# Execute commands inside running container
docker exec -it halo-reporting sh

# View container resource usage
docker stats halo-reporting

# Inspect container configuration
docker inspect halo-reporting

# Check health status
docker inspect --format='{{.State.Health.Status}}' halo-reporting
```

## Production Deployment

### Using Docker Compose (Recommended)

1. **Clone repository on your server:**
```bash
git clone https://github.com/allyourcomputers/AYC-Reporting-Dashboard.git
cd AYC-Reporting-Dashboard
```

2. **Configure environment:**
```bash
cp .env.example .env
nano .env
```

Set production values:
```env
HALO_API_URL=https://helpdesk.allyourcomputers.co.uk/api
HALO_CLIENT_ID=your-production-client-id
HALO_CLIENT_SECRET=your-production-client-secret
SUPABASE_URL=http://allyoursoftware.co.uk:8000
SUPABASE_KEY=your-production-anon-key
PORT=3100
```

3. **Deploy:**
```bash
docker-compose up -d
```

4. **Verify deployment:**
```bash
docker-compose ps
docker-compose logs -f
curl http://localhost:3100/api/config
```

### Behind Nginx Reverse Proxy

If using Nginx as a reverse proxy:

**docker-compose.yml:**
```yaml
services:
  halo-reporting:
    ports:
      - "127.0.0.1:3100:3100"  # Only bind to localhost
```

**Nginx configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Multi-Stage Build (Advanced)

For a smaller production image, create `Dockerfile.multistage`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/*.js ./
COPY --from=builder /app/public ./public

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
CMD ["node", "server-supabase.js"]
```

Build with:
```bash
docker build -f Dockerfile.multistage -t halo-reporting:latest .
```

## Docker with Supabase (All-in-One)

If running Supabase in Docker on the same server, use Docker networking:

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  halo-reporting:
    build: .
    ports:
      - "80:3100"
    environment:
      - SUPABASE_URL=http://supabase:8000
    networks:
      - app-network
    depends_on:
      - supabase

  supabase:
    # Your Supabase container configuration
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

## Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Or in one command
docker-compose up -d --build
```

## Troubleshooting

### Container Won't Start

Check logs:
```bash
docker-compose logs halo-reporting
```

Common issues:
- Missing `.env` file
- Invalid environment variables
- Port already in use

### Port Already in Use

```bash
# Find what's using the port
sudo netstat -tlnp | grep :3100

# Stop the conflicting service or change the port
```

### Permission Denied on Port 80

Run docker-compose with sudo or add your user to the docker group:
```bash
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect
```

### Cannot Connect to Application

1. Check container is running:
```bash
docker ps
```

2. Check container health:
```bash
docker inspect --format='{{.State.Health.Status}}' halo-reporting
```

3. Test from inside container:
```bash
docker exec -it halo-reporting sh
wget -O- http://localhost:3100/api/config
```

4. Check firewall:
```bash
sudo ufw status
sudo ufw allow 3000
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `HALO_API_URL` | HaloPSA API endpoint | `https://helpdesk.example.com/api` |
| `HALO_CLIENT_ID` | HaloPSA OAuth client ID | `your-client-id` |
| `HALO_CLIENT_SECRET` | HaloPSA OAuth client secret | `your-secret` |
| `SUPABASE_URL` | Supabase instance URL | `http://example.com:8000` |
| `SUPABASE_KEY` | Supabase anon/public key | `eyJhbGc...` |
| `PORT` | Port to run on (inside container) | `3000` |
| `NODE_ENV` | Node environment | `production` |

## Security Best Practices

1. **Never commit `.env` files** - They contain secrets
2. **Use Docker secrets** for sensitive data in production
3. **Run as non-root user** - Already configured in Dockerfile
4. **Keep images updated** - Regularly rebuild with latest base image
5. **Scan for vulnerabilities:**
```bash
docker scan halo-reporting:latest
```

## Monitoring

### Docker Stats
```bash
# Real-time stats
docker stats halo-reporting

# One-time stats
docker stats --no-stream halo-reporting
```

### Health Checks
```bash
# Check health status
docker inspect --format='{{json .State.Health}}' halo-reporting | jq
```

### Logs
```bash
# Last 100 lines
docker logs --tail 100 halo-reporting

# Since specific time
docker logs --since 1h halo-reporting

# Export logs
docker logs halo-reporting > app.log 2>&1
```

## Backup and Restore

### Backup
```bash
# Export container
docker export halo-reporting > halo-reporting-backup.tar

# Save image
docker save halo-reporting:latest > halo-reporting-image.tar
```

### Restore
```bash
# Load image
docker load < halo-reporting-image.tar

# Run from backup
docker import halo-reporting-backup.tar
```

## Next Steps

After deploying with Docker:

1. Set up user accounts in Supabase (see `AUTH_SETUP.md`)
2. Configure reverse proxy if needed (Nginx/Apache)
3. Set up SSL/TLS certificates (Let's Encrypt)
4. Configure automated backups
5. Set up monitoring and alerts

For PM2 deployment, see `PRODUCTION_SETUP.md`
