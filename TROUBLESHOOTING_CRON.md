# Troubleshooting Cron in Docker Container

## Quick Diagnostic Steps

Run these commands on your server to diagnose the cron issue:

### 1. Check if container is running the new image

```bash
# Check when the image was built
docker images | grep halo-reporting

# Check when the container was created
docker ps -a | grep halo-reporting

# If the image is newer than the container, you need to recreate it
```

### 2. Check what processes are running inside the container

```bash
# List all processes
docker exec -it halo-reporting ps aux

# You should see:
# - node server-supabase.js (the web app)
# - crond (the cron daemon)
```

### 3. Check container logs

```bash
# View startup logs
docker logs halo-reporting | head -20

# You should see:
# "Starting HaloPSA Reporting Dashboard..."
# "Starting cron daemon..."
# "Cron daemon started. Sync will run daily at 2am UTC."
```

### 4. Check if entrypoint script is being used

```bash
# Inspect the container
docker inspect halo-reporting | grep -A 5 Entrypoint

# Should show: "/app/docker-entrypoint.sh"
```

## Common Issues and Fixes

### Issue 1: Container Not Rebuilt

**Problem:** Container is still using the old image without cron.

**Solution:**
```bash
cd /home/ubuntu/AYC-Reporting-Dashboard

# Stop and remove the old container
docker-compose down

# Remove old image (optional but ensures clean build)
docker rmi halo-reporting:latest

# Rebuild from scratch
docker-compose build --no-cache

# Start with new image
docker-compose up -d

# Verify
docker logs halo-reporting
```

### Issue 2: Entrypoint Script Not Executable

**Problem:** The entrypoint script doesn't have execute permissions.

**Check:**
```bash
docker exec -it halo-reporting ls -la /app/docker-entrypoint.sh
```

**Fix:** Already handled in Dockerfile, but if needed:
```bash
docker exec -it halo-reporting chmod +x /app/docker-entrypoint.sh
docker restart halo-reporting
```

### Issue 3: Cron Daemon Failed to Start

**Problem:** Cron daemon encountered an error during startup.

**Check:**
```bash
# Check for cron-related errors
docker logs halo-reporting 2>&1 | grep -i cron

# Check if crontab file exists
docker exec -it halo-reporting cat /etc/crontabs/root
```

### Issue 4: Alpine Linux Cron Syntax Issue

**Problem:** Crontab format might not be compatible with Alpine's crond.

**Check:**
```bash
# Verify crontab format
docker exec -it halo-reporting cat /etc/crontabs/root

# Should show:
# 0 2 * * * /app/sync-cron.sh
```

## Step-by-Step Resolution

Follow these steps in order:

### Step 1: Rebuild Container

```bash
cd /home/ubuntu/AYC-Reporting-Dashboard

# Stop current container
docker-compose down

# Build fresh image
docker-compose build --no-cache

# Start container
docker-compose up -d
```

### Step 2: Check Startup Logs

```bash
# Wait a few seconds for startup, then check logs
docker logs halo-reporting

# Expected output:
# Starting HaloPSA Reporting Dashboard...
# Starting cron daemon...
# Cron daemon started. Sync will run daily at 2am UTC.
# Logs available at: /var/log/sync.log
# Starting Node.js application on port 3100...
# HaloPSA Reporting Server (Supabase) running on http://localhost:3100
```

### Step 3: Verify Processes

```bash
# Check all running processes
docker exec -it halo-reporting ps aux

# You should see at least:
# PID   USER     COMMAND
# 1     root     sh /app/docker-entrypoint.sh
# X     root     crond -b -l 2
# Y     nodejs   node server-supabase.js
```

### Step 4: Test Cron

```bash
# Check cron logs (will be empty until first run)
docker exec -it halo-reporting cat /var/log/sync.log

# Manually trigger sync to test
docker exec -it halo-reporting /app/sync-cron.sh

# Check logs again
docker exec -it halo-reporting cat /var/log/sync.log
```

## Manual Test of Sync

To verify the sync works independently of cron:

```bash
# Test sync-cron.sh script directly
docker exec -it halo-reporting sh -c "/app/sync-cron.sh"

# Check the log
docker exec -it halo-reporting tail -20 /var/log/sync.log

# If sync works, cron is just not running
# If sync fails, there's an issue with the sync script
```

## Alternative: Run Cron Manually for Testing

If you want to test if cron can run at all:

```bash
# Access container shell
docker exec -it halo-reporting sh

# Start cron manually
crond -b -l 2

# Check if it's running
ps aux | grep crond

# Exit
exit
```

## Verify Files Are in Container

```bash
# Check all required files exist
docker exec -it halo-reporting ls -la /app/ | grep -E "entrypoint|sync-cron|crontab"
docker exec -it halo-reporting ls -la /etc/crontabs/

# Verify permissions
docker exec -it halo-reporting ls -la /app/docker-entrypoint.sh
docker exec -it halo-reporting ls -la /app/sync-cron.sh
```

## Check Docker Compose Version

Some issues can occur with older docker-compose versions:

```bash
docker-compose --version

# Should be 2.0+
# If older, update: sudo apt-get update && sudo apt-get install docker-compose-plugin
```

## If All Else Fails

### Temporary Workaround: Use Host Cron

If you can't get cron working in the container, set up cron on your host:

```bash
# Edit host crontab
crontab -e

# Add this line (runs sync inside container):
0 2 * * * docker exec halo-reporting node sync-service.js >> /var/log/halo-sync.log 2>&1
```

This achieves the same result (daily sync at 2am) but runs from the host instead of inside the container.

## Get Debug Information

Run this comprehensive check:

```bash
echo "=== Container Status ==="
docker ps | grep halo-reporting

echo -e "\n=== Container Logs ==="
docker logs halo-reporting | head -30

echo -e "\n=== Running Processes ==="
docker exec -it halo-reporting ps aux

echo -e "\n=== Entrypoint Script ==="
docker exec -it halo-reporting cat /app/docker-entrypoint.sh | head -10

echo -e "\n=== Crontab ==="
docker exec -it halo-reporting cat /etc/crontabs/root

echo -e "\n=== Image Build Date ==="
docker images | grep halo-reporting
```

Share the output of this script if you need further assistance.
