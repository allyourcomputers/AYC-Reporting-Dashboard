#!/bin/sh
# Sync script called by cron
# Runs the HaloPSA to Supabase sync

cd /app

# Log the sync start time
echo "[$(date)] Starting scheduled sync..." >> /var/log/sync.log

# Run the sync service
node sync-service.js >> /var/log/sync.log 2>&1

# Log completion
echo "[$(date)] Sync completed" >> /var/log/sync.log
