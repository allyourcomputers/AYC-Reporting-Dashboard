#!/bin/bash
# Quick deployment script (uses Docker cache for faster builds)
# Use this for routine updates. Use deploy.sh for major updates.

set -e

echo "🚀 Quick Deploy - HaloPSA Reporting Dashboard"
echo ""

# Stop container
echo "→ Stopping container..."
docker-compose down

# Pull latest code
echo "→ Pulling latest code..."
git pull origin $(git rev-parse --abbrev-ref HEAD)

# Rebuild (with cache)
echo "→ Rebuilding image (using cache)..."
docker-compose build

# Start container
echo "→ Starting container..."
docker-compose up -d

# Wait and show status
sleep 3
echo ""
echo "✓ Deployment complete!"
docker-compose ps
echo ""
echo "View logs: docker-compose logs -f"
