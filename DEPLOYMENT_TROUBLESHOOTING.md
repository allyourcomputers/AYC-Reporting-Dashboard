# Deployment Troubleshooting Guide

## Issue: "Failed to Fetch" on Login Screen

This error occurs when the browser cannot reach the `/api/config` endpoint on your server.

## Troubleshooting Steps

### 1. Check if the Server is Running

SSH into your web server and run:
```bash
# Check if Node.js process is running
ps aux | grep "node server-supabase.js"

# If using pm2
pm2 list

# If using systemd
sudo systemctl status your-app-name
```

If the server isn't running, start it with your process manager.

### 2. Verify the PORT Configuration

Check your production `.env` file:
```bash
cat /path/to/your/app/.env | grep PORT
```

**Important:** For production deployment on standard HTTP (port 80), your `.env` should have:
```
PORT=80
```

If it's set to 3000 or another port, you need to either:
- **Option A:** Change it to `PORT=80` and restart the server
- **Option B:** Access your site with the port number: `http://yourserver.com:3100`

### 3. Check Server Logs

Look at your server logs to see if there are any errors:
```bash
# If using pm2
pm2 logs your-app-name

# If using systemd
sudo journalctl -u your-app-name -f

# Or check the console output directly
node server-supabase.js
```

You should see:
```
HaloPSA Reporting Server (Supabase) running on http://localhost:PORT
```

### 4. Test the API Endpoint Directly

From your web server, test if the endpoint responds:
```bash
# Replace PORT with your actual port (80 or 3000)
curl http://localhost:PORT/api/config

# You should see something like:
# {"supabaseUrl":"http://...","supabaseAnonKey":"eyJ..."}
```

### 5. Check Firewall Settings

If the server is running but still not accessible:
```bash
# Check if the port is open
sudo netstat -tlnp | grep :80

# Check firewall rules (Ubuntu/Debian)
sudo ufw status

# Check firewall rules (CentOS/RHEL)
sudo firewall-cmd --list-all
```

Make sure port 80 (or your configured port) is open.

### 6. Restart Your Process Manager

After making changes to `.env`:
```bash
# If using pm2
pm2 restart your-app-name

# If using forever
forever restart server-supabase.js

# If using systemd
sudo systemctl restart your-app-name
```

## Common Solutions

### Solution 1: Wrong Port
Your server is running on port 3100, but you're accessing it on port 80.

**Fix:** Update your production `.env`:
```bash
PORT=80
```
Then restart the server.

### Solution 2: Permission Issue
Port 80 requires root/sudo privileges.

**Fix:** Either:
- Run with sudo/root (not recommended)
- Use a reverse proxy (Nginx/Apache) - recommended
- Use port 3100 and access via `http://yourserver.com:3100`

### Solution 3: Server Not Running
The Node.js process crashed or wasn't started.

**Fix:** Start it with your process manager:
```bash
pm2 start server-supabase.js --name halo-reporting
```

## Quick Deployment Checklist

For a fresh deployment:

1. ✅ Copy `.env.example` to `.env` and configure all values
2. ✅ Set `PORT=80` in production `.env` (or use reverse proxy)
3. ✅ Run `npm install` to install dependencies
4. ✅ Start with process manager: `pm2 start server-supabase.js --name halo-reporting`
5. ✅ Test endpoint: `curl http://localhost:80/api/config`
6. ✅ Check browser console for detailed error messages
7. ✅ Verify Supabase credentials are correct in `.env`

## Still Having Issues?

Open your browser's Developer Console (F12) and:
1. Go to the Console tab
2. Refresh the login page
3. Look for the error message that appears
4. The error will show the specific issue (404, 500, network error, etc.)

Share that error message for more specific troubleshooting.
