#!/bin/bash
# Test environment variables in Docker container

echo "Testing environment variables in container..."
docker exec halo-reporting sh -c '
echo "=== Environment Variables ==="
echo "SUPABASE_URL: ${SUPABASE_URL:0:20}... (truncated)"
echo "SUPABASE_KEY: ${SUPABASE_KEY:0:20}... (truncated)"
echo "HALO_API_URL: ${HALO_API_URL:0:20}... (truncated)"
echo "HALO_CLIENT_ID: ${HALO_CLIENT_ID:0:20}... (truncated)"
echo "HALO_CLIENT_SECRET: ${HALO_CLIENT_SECRET:0:10}... (truncated)"
echo "PORT: $PORT"
echo "NODE_ENV: $NODE_ENV"
echo ""
echo "=== .env file check ==="
ls -la /app/.env 2>&1 || echo ".env file does NOT exist in container (this is expected)"
echo ""
echo "=== Process check ==="
ps aux | grep node
'
