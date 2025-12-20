# Diagnostic Guide for "Failed to Fetch" Errors

This guide will help you diagnose and troubleshoot "Failed to Fetch" errors in the Docker deployment.

## Log Files

The application now writes comprehensive logs to help diagnose issues:

### 1. Application Log (`/var/log/app.log`)
Contains all server-side logs including:
- Incoming HTTP requests (method, URL, headers, IP)
- Response details (status code, duration)
- API endpoint calls with full context
- Server startup information
- Error details with stack traces

### 2. Sync Log (`/var/log/sync.log`)
Contains logs from the HaloPSA sync cron job.

## How to View Logs in Docker

### View Application Logs (Real-time)
```bash
docker exec -it <container-name> tail -f /var/log/app.log
```

### View All Application Logs
```bash
docker exec -it <container-name> cat /var/log/app.log
```

### View Last 100 Lines
```bash
docker exec -it <container-name> tail -n 100 /var/log/app.log
```

### Copy Logs to Your Local Machine
```bash
docker cp <container-name>:/var/log/app.log ./app.log
docker cp <container-name>:/var/log/sync.log ./sync.log
```

### View Container Logs (stdout/stderr)
```bash
docker logs <container-name>
docker logs -f <container-name>  # Follow mode
```

## What to Look For

### 1. Server Startup Issues

Check if the server started successfully:
```bash
docker logs <container-name> | grep "Server started successfully"
```

Look for environment variable status:
```bash
docker logs <container-name> | grep "Environment check"
```

### 2. Missing Environment Variables

If you see this error in the logs:
```
ERROR: Supabase configuration incomplete
```

This means one or more required environment variables are missing:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

**Fix:** Ensure your `.env` file exists in the same directory as `docker-compose.yml` and contains all required variables.

### 3. Failed /api/config Requests

Search for `/api/config` requests in the logs:
```bash
docker exec -it <container-name> grep "/api/config" /var/log/app.log
```

You should see:
- An incoming request log
- The endpoint being called with environment variable status
- A response log with status 200

If you see status 500, check the error details immediately above it.

### 4. Network Connectivity Issues

If the browser shows "Failed to Fetch" but no request appears in `/var/log/app.log`:
- The request never reached the server
- Possible causes:
  - Port mapping issue in Docker
  - Firewall blocking the connection
  - Wrong URL/hostname
  - DNS resolution issue

**Check port mapping:**
```bash
docker ps
```
Look for the port mapping (should show something like `0.0.0.0:3100->3100/tcp`)

**Test server accessibility:**
```bash
# From inside the container
docker exec -it <container-name> wget -O- http://localhost:3100/api/config

# From the host machine
curl http://localhost:3100/api/config
```

### 5. Browser Console Logs

The client-side JavaScript now includes detailed logging. Open the browser's Developer Console (F12) and look for:

**Successful flow:**
```
=== INIT AUTH START ===
Current location: http://...
Attempting to fetch /api/config...
Fetch response received: { status: 200, ... }
Config received: { supabaseUrlSet: true, ... }
Creating Supabase client...
=== INIT AUTH COMPLETE ===
```

**Failed flow will show:**
```
=== ERROR DETAILS ===
{
  "timestamp": "...",
  "context": "initAuth",
  "error": {
    "message": "...",
    "name": "...",
    "stack": "..."
  },
  "location": { ... },
  "browserInfo": { ... }
}
```

## Common Issues and Solutions

### Issue: "Failed to fetch"
**Symptoms:** Browser console shows network error, no request in app.log

**Diagnosis:**
1. Check if container is running: `docker ps`
2. Check port mapping: `docker port <container-name>`
3. Test from host: `curl http://localhost:3100/api/config`
4. Check firewall settings

**Solutions:**
- Ensure port 3100 is exposed and mapped correctly
- Check if another service is using port 3100
- Verify `PORT` environment variable matches exposed port

### Issue: "Server configuration error"
**Symptoms:** Status 500 in browser, app.log shows missing environment variables

**Diagnosis:**
```bash
docker exec -it <container-name> grep "Environment check" /var/log/app.log
```

**Solutions:**
1. Create/update `.env` file with required variables
2. Restart container: `docker-compose restart`
3. Verify variables loaded: Check startup logs

### Issue: "CORS error"
**Symptoms:** Browser console shows CORS policy error

**Diagnosis:**
Check request headers in app.log for `origin` field

**Solutions:**
- Ensure you're accessing via the correct hostname
- If using a proxy/reverse proxy, ensure proper headers are forwarded

## Monitoring Commands

### Continuous monitoring (run these in separate terminals):

Terminal 1 - Application logs:
```bash
docker exec -it <container-name> tail -f /var/log/app.log
```

Terminal 2 - Container logs:
```bash
docker logs -f <container-name>
```

Terminal 3 - Browser Developer Console
- Open your browser's Developer Tools (F12)
- Go to Console tab
- Try accessing the application

## Getting Help

When reporting issues, include:
1. Output of: `docker logs <container-name>`
2. Contents of: `/var/log/app.log` (last 200 lines)
3. Browser console logs (screenshot or copy/paste)
4. Output of: `docker ps` and `docker port <container-name>`
5. Your `.env` file structure (WITHOUT actual values)

Example:
```
SUPABASE_URL=https://...supabase.co  ✓ SET
SUPABASE_SERVICE_ROLE_KEY=...        ✓ SET
SUPABASE_ANON_KEY=...                ✓ SET
HALO_API_URL=...                     ✓ SET
```
