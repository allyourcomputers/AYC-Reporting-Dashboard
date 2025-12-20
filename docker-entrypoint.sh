#!/bin/sh
# Docker entrypoint script
# Starts both cron and the Node.js application

set -e

echo "Starting HaloPSA Reporting Dashboard..."

# Ensure log files exist with correct permissions
touch /var/log/sync.log
touch /var/log/app.log
chmod 666 /var/log/sync.log
chmod 666 /var/log/app.log
echo "Log files ready:"
echo "  - Sync logs: /var/log/sync.log"
echo "  - App logs:  /var/log/app.log"

# Start cron daemon in the background (runs as root for cron functionality)
echo "Starting cron daemon..."
crond -b -l 2

# Wait a moment for cron to start
sleep 1

echo "Cron daemon started. Sync will run daily at 2am UTC."
echo "Logs available at: /var/log/sync.log"

# Start the Node.js application (runs as nodejs user via su)
echo "Starting Node.js application on port ${PORT:-3100}..."
exec su-exec nodejs node server-supabase.js
