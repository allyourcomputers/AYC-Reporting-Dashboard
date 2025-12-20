# NGINX Setup Guide for Supabase Proxy

This guide explains how to fix the "Failed to Fetch" error caused by mixed content (HTTPS app accessing HTTP Supabase).

## The Problem

- Your reporting app is served over HTTPS: `https://reporting.allyoursoftware.co.uk`
- Your Supabase instance was configured with HTTP: `http://allyoursoftware.co.uk:8000`
- Browsers block HTTP requests from HTTPS pages (Mixed Content Security)

## The Solution

Use NGINX to proxy Supabase over HTTPS at `https://supabase.allyoursoftware.co.uk`

## Step-by-Step Setup

### 1. Update NGINX Configuration

Replace your existing Supabase NGINX configuration with the one from `nginx-supabase.conf`:

```bash
# Edit your NGINX config file
sudo nano /etc/nginx/sites-available/supabase

# Or if using a different config structure:
sudo nano /etc/nginx/conf.d/supabase.conf
```

Copy the contents from `nginx-supabase.conf` in this repository.

**Key differences from your original config:**
- Added `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host` headers
- Increased timeouts for long-running requests
- Added buffer size configurations
- Disabled buffering for streaming responses

### 2. Test NGINX Configuration

```bash
sudo nginx -t
```

You should see:
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 3. Reload NGINX

```bash
sudo systemctl reload nginx
```

### 4. Update Environment Variables on Server

On your server, update the `.env` file:

```bash
# Navigate to your docker-compose directory
cd /path/to/halo-reporting

# Edit .env file
nano .env
```

Change:
```bash
# OLD - causes mixed content error
SUPABASE_URL=http://allyoursoftware.co.uk:8000

# NEW - works with HTTPS
SUPABASE_URL=https://supabase.allyoursoftware.co.uk
```

### 5. Restart Docker Container

```bash
docker-compose down
docker-compose up -d
```

### 6. Verify the Fix

1. **Test Supabase HTTPS endpoint:**
   ```bash
   curl https://supabase.allyoursoftware.co.uk/rest/v1/
   ```
   Should return Supabase API response (not an error)

2. **Check if login works:**
   - Visit: `https://supabase.allyoursoftware.co.uk`
   - Try logging into Supabase Studio

3. **Test the reporting app:**
   - Visit: `https://reporting.allyoursoftware.co.uk`
   - Check browser console (F12) - should see successful API calls
   - Try logging in

### 7. Check Logs

```bash
# View application logs
docker logs halo-reporting -f

# Or check the app.log file
docker exec -it halo-reporting tail -f /var/log/app.log
```

You should see:
```json
{"message":"Server started successfully","data":{"port":"3100",...}}
{"message":"/api/config endpoint called","data":{"supabaseUrlPreview":"https://supabase.allyoursoftwa..."}}
```

## Troubleshooting

### Issue: Supabase login still doesn't work

**Check if Supabase needs to know its external URL:**

1. Find your Supabase configuration file (usually `docker-compose.yml` or `supabase/config.toml`)
2. Look for settings like `API_EXTERNAL_URL` or `SITE_URL`
3. Update them to use `https://supabase.allyoursoftware.co.uk`

Example in `docker-compose.yml`:
```yaml
services:
  kong:
    environment:
      KONG_PROXY_URL: https://supabase.allyoursoftware.co.uk

  auth:
    environment:
      SITE_URL: https://supabase.allyoursoftware.co.uk
      API_EXTERNAL_URL: https://supabase.allyoursoftware.co.uk
```

### Issue: CORS errors

Add CORS headers to NGINX if needed:
```nginx
add_header Access-Control-Allow-Origin *;
add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS, PUT, DELETE';
add_header Access-Control-Allow-Headers 'Authorization, Content-Type';
```

### Issue: SSL certificate errors

If you don't have an SSL certificate for `supabase.allyoursoftware.co.uk`:

```bash
# Using Certbot/Let's Encrypt
sudo certbot --nginx -d supabase.allyoursoftware.co.uk
```

Or use your existing wildcard certificate if you have one.

## Expected Result

After completing these steps:
- ✅ Supabase accessible via HTTPS
- ✅ Reporting app works without mixed content errors
- ✅ Login to both Supabase Studio and Reporting app works
- ✅ No "Failed to Fetch" errors in browser console

## Additional Notes

### Firewall Rules

Ensure your firewall allows HTTPS traffic:
```bash
sudo ufw allow 443/tcp
sudo ufw status
```

### Port 8000 Access

You can now block external access to port 8000 since everything goes through NGINX:
```bash
# Only allow localhost to access port 8000
sudo ufw delete allow 8000/tcp
```

### Performance

The NGINX proxy adds minimal overhead and provides benefits:
- SSL termination
- Request buffering
- Load balancing capability
- Better logging and monitoring

## Summary

The `.env` file in this repository has been updated to use:
```
SUPABASE_URL=https://supabase.allyoursoftware.co.uk
```

You need to:
1. Update your server's NGINX config with the provided `nginx-supabase.conf`
2. Update your server's `.env` file to match
3. Reload NGINX and restart Docker

This will fix the "Failed to Fetch" error permanently.
