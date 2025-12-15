# Migration Guide: PM2 to Docker

This guide will help you migrate your HaloPSA Reporting Dashboard from PM2 to Docker deployment.

## Pre-Migration Checklist

Before starting, make sure:
- [ ] Docker is installed on your server
- [ ] Docker Compose is installed
- [ ] You have SSH access to your server
- [ ] You know the current working directory of your app
- [ ] You have a backup of your `.env` file

## Step-by-Step Migration

### Step 1: Verify Current Setup

SSH into your server and check your current PM2 setup:

```bash
# Check PM2 status
pm2 list

# Note the app name (likely "halo-reporting")
# Check which directory it's running from
pm2 info halo-reporting | grep "exec cwd"

# Navigate to your app directory
cd /path/to/halo-reporting

# Verify the app is working
curl http://localhost/api/config
```

**Expected output:** You should see your Supabase configuration JSON.

### Step 2: Backup Your Configuration

```bash
# Backup your .env file
cp .env .env.backup

# Verify backup
cat .env.backup
```

**Important:** Make sure your `.env` has:
- `SUPABASE_URL=http://allyoursoftware.co.uk:8000` (your public domain, NOT 127.0.0.1)
- `PORT=3000` (Docker will handle port mapping)

### Step 3: Pull Latest Code

```bash
# Make sure you're in your app directory
cd /path/to/halo-reporting

# Pull latest changes (includes Docker files)
git pull origin main

# Verify Docker files are present
ls -la | grep -E "Dockerfile|docker-compose"
```

**Expected output:** You should see:
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

### Step 4: Stop PM2 Application

```bash
# Stop the app (but don't delete it yet, in case we need to rollback)
pm2 stop halo-reporting

# Verify it's stopped
pm2 list

# Test that the app is no longer accessible
curl http://localhost/api/config
```

**Expected output:** Connection should be refused or timeout.

### Step 5: Verify Environment Variables

```bash
# Check your .env file
cat .env

# Make sure these are set correctly:
# - SUPABASE_URL should be your PUBLIC domain (not 127.0.0.1)
# - PORT can be 3000 (Docker handles port mapping)
```

**Critical:** If `SUPABASE_URL=http://127.0.0.1:8000`, change it:

```bash
nano .env
# Change to: SUPABASE_URL=http://allyoursoftware.co.uk:8000
# Save: Ctrl+X, Y, Enter
```

### Step 6: Verify Docker Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker-compose --version

# If not installed, install Docker:
# Ubuntu/Debian:
# curl -fsSL https://get.docker.com -o get-docker.sh
# sudo sh get-docker.sh
# sudo usermod -aG docker $USER
# Then log out and back in
```

**Expected output:**
- Docker version 20.10+
- Docker Compose version 2.0+

### Step 7: Build Docker Image

```bash
# Make sure you're in your app directory
cd /path/to/halo-reporting

# Build the Docker image
docker-compose build

# This will take 1-2 minutes
```

**Expected output:**
```
Successfully built <image-id>
Successfully tagged halo-reporting:latest
```

### Step 8: Start with Docker

Now we'll start the app with Docker. Choose your deployment method:

#### Option A: Run on Port 80 (Recommended if currently on port 80)

```bash
# Edit docker-compose.yml to use port 80
nano docker-compose.yml

# Change this line:
#   - "${PORT:-3000}:3000"
# To:
#   - "80:3000"

# Save and exit (Ctrl+X, Y, Enter)

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f
```

#### Option B: Run on Port 3000

```bash
# Start the container (uses port 3000 by default)
docker-compose up -d

# View logs
docker-compose logs -f
```

**Expected output:**
```
halo-reporting | HaloPSA Reporting Server (Supabase) running on http://localhost:3000
```

Press `Ctrl+C` to exit logs (container keeps running).

### Step 9: Verify Docker Deployment

```bash
# Check container status
docker-compose ps

# Should show:
# NAME             STATUS          PORTS
# halo-reporting   Up X seconds    0.0.0.0:80->3000/tcp (or 3000->3000)

# Test the endpoint
curl http://localhost/api/config
# or if on port 3000:
curl http://localhost:3000/api/config

# Check health status
docker inspect --format='{{.State.Health.Status}}' halo-reporting
```

**Expected output:**
- Container status: "Up"
- API config returns JSON
- Health status: "healthy"

### Step 10: Test Login in Browser

1. Open your browser
2. Go to your domain (e.g., `http://allyoursoftware.co.uk`)
3. You should see the login page
4. Log in with your Supabase credentials
5. Verify the dashboard loads correctly

**If login fails:** Check browser console (F12) for error messages.

### Step 11: Configure Auto-Start on Reboot

Docker Compose is already configured to restart containers automatically. Verify:

```bash
# Check restart policy
docker inspect halo-reporting | grep -A 5 RestartPolicy
```

**Expected output:**
```json
"RestartPolicy": {
    "Name": "unless-stopped",
    ...
}
```

This means Docker will automatically start your container on server reboot.

### Step 12: Remove PM2 (Optional)

Once you're confident Docker is working:

```bash
# Delete the PM2 app
pm2 delete halo-reporting

# Save PM2 state
pm2 save

# Verify it's gone
pm2 list
```

**Optional:** Keep PM2 for other apps, or remove completely:
```bash
# To remove PM2 startup script (if no other apps use it)
pm2 unstartup
```

## Rollback Plan (If Needed)

If something goes wrong, you can quickly rollback to PM2:

```bash
# Stop Docker container
docker-compose down

# Start PM2 app again
pm2 start halo-reporting
pm2 save

# Verify it's working
curl http://localhost/api/config
```

## Post-Migration Tasks

### Update Deployment Workflow

Your new deployment workflow is:

```bash
# SSH into server
ssh your-server

# Navigate to app directory
cd /path/to/halo-reporting

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# View logs
docker-compose logs -f --tail 50
```

### Monitor Your Application

```bash
# View logs
docker-compose logs -f

# Check resource usage
docker stats halo-reporting

# Check container health
docker inspect --format='{{.State.Health.Status}}' halo-reporting

# Restart if needed
docker-compose restart

# Stop
docker-compose down

# Start
docker-compose up -d
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker-compose logs

# Common issues:
# 1. Port already in use - Check: sudo netstat -tlnp | grep :80
# 2. Missing .env file - Ensure .env exists
# 3. Wrong SUPABASE_URL - Check .env has public domain
```

### Login Failed to Fetch Error

```bash
# Check SUPABASE_URL in running container
docker exec halo-reporting sh -c 'echo $SUPABASE_URL'

# Should show: http://allyoursoftware.co.uk:8000
# NOT: http://127.0.0.1:8000

# If wrong, fix .env and restart:
nano .env
docker-compose restart
```

### Port Permission Denied

If you get permission errors on port 80:

```bash
# Option 1: Run with sudo
sudo docker-compose up -d

# Option 2: Add user to docker group (then log out/in)
sudo usermod -aG docker $USER

# Option 3: Use port 3000 instead
# Edit docker-compose.yml to use port 3000
```

### Container Keeps Restarting

```bash
# Check why it's failing
docker-compose logs --tail 50

# Check health
docker inspect halo-reporting | grep -A 10 Health

# Common causes:
# 1. Missing environment variables
# 2. Wrong SUPABASE_URL
# 3. Port conflict
```

## Migration Complete! ✅

Your app is now running in Docker. Benefits:

- ✅ Isolated environment
- ✅ Automatic restarts on failure
- ✅ Easy updates with `docker-compose up -d --build`
- ✅ Health monitoring
- ✅ Portable across servers

## Quick Reference

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Update app
git pull && docker-compose up -d --build

# Check status
docker-compose ps

# Execute command in container
docker exec -it halo-reporting sh
```

## Need Help?

- Check `DOCKER_DEPLOYMENT.md` for detailed Docker documentation
- Check `DEPLOYMENT_TROUBLESHOOTING.md` for common issues
- View container logs: `docker-compose logs -f`
