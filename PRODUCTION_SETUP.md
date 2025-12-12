# Production Deployment Setup

## Quick Setup with PM2 (Recommended)

PM2 is a process manager that keeps your Node.js app running in the background, restarts it on crashes, and starts on server reboot.

### Step 1: Install PM2

SSH into your web server and run:
```bash
sudo npm install -g pm2
```

### Step 2: Configure Your Environment

Make sure your `.env` file is set up for production:
```bash
# In your app directory
nano .env
```

Set the PORT to 80 (or keep it at 3000 if using a reverse proxy):
```
PORT=80
```

### Step 3: Start Your App with PM2

```bash
# Navigate to your app directory
cd /path/to/halo-reporting

# Start the app with PM2
pm2 start server-supabase.js --name halo-reporting

# Save the PM2 process list
pm2 save

# Setup PM2 to start on server reboot
pm2 startup
# Follow the command it gives you (will look like: sudo env PATH=...)
```

### Step 4: Verify It's Running

```bash
# Check status
pm2 status

# View logs
pm2 logs halo-reporting

# Test the endpoint
curl http://localhost:80/api/config
```

### Common PM2 Commands

```bash
# View app status
pm2 list

# View logs
pm2 logs halo-reporting

# Restart app
pm2 restart halo-reporting

# Stop app
pm2 stop halo-reporting

# Delete from PM2
pm2 delete halo-reporting

# Monitor in real-time
pm2 monit
```

## Alternative: Systemd Service (If You Can't Use PM2)

If you cannot install PM2, you can create a systemd service:

### Create Service File

```bash
sudo nano /etc/systemd/system/halo-reporting.service
```

Add this content (adjust paths to match your server):
```ini
[Unit]
Description=HaloPSA Reporting Dashboard
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/halo-reporting
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /path/to/halo-reporting/server-supabase.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Enable and Start the Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable halo-reporting

# Start the service
sudo systemctl start halo-reporting

# Check status
sudo systemctl status halo-reporting

# View logs
sudo journalctl -u halo-reporting -f
```

## Temporary Solution: Screen/Tmux

If you need a quick temporary solution (NOT recommended for production):

### Using Screen

```bash
# Install screen
sudo apt-get install screen  # Ubuntu/Debian
# or
sudo yum install screen      # CentOS/RHEL

# Start a screen session
screen -S halo-reporting

# Start your app
npm start

# Detach from screen: Press Ctrl+A, then D

# Reattach later
screen -r halo-reporting

# List sessions
screen -ls
```

## Port 80 Permissions

If you're running on port 80, you may need to:

### Option 1: Use authbind (Recommended)
```bash
# Install authbind
sudo apt-get install authbind  # Ubuntu/Debian

# Allow your user to bind to port 80
sudo touch /etc/authbind/byport/80
sudo chmod 500 /etc/authbind/byport/80
sudo chown your-username /etc/authbind/byport/80

# Start with PM2 using authbind
pm2 start server-supabase.js --name halo-reporting -- --port 80
```

### Option 2: Use setcap
```bash
# Give Node.js permission to bind to privileged ports
sudo setcap 'cap_net_bind_service=+ep' $(which node)
```

### Option 3: Use a Higher Port with Reverse Proxy (Best Practice)
Keep your app on port 3000 and use Nginx or Apache as a reverse proxy on port 80.

## Checking Current Process

To see if your app is currently running:
```bash
# Check for Node.js processes
ps aux | grep node

# Check what's listening on port 80
sudo netstat -tlnp | grep :80

# Check what's listening on port 3000
sudo netstat -tlnp | grep :3000

# Kill a stuck process if needed
sudo kill -9 PID_NUMBER
```

## Deployment Workflow

After setting up PM2, your deployment workflow becomes:

```bash
# SSH into server
ssh your-server

# Navigate to app directory
cd /path/to/halo-reporting

# Pull latest code
git pull origin main

# Install any new dependencies
npm install

# Restart the app
pm2 restart halo-reporting

# Check it's running
pm2 status
pm2 logs halo-reporting --lines 50
```

## Next Steps

1. Install PM2 on your web server
2. Configure `.env` for production (PORT=80)
3. Start your app with PM2
4. Test the login page
5. Set up PM2 to start on server reboot

Your app will now stay running even after you close your SSH session!
