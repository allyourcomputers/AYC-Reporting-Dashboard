#!/bin/bash
# Quick deployment script (uses Docker cache for faster builds)
# Use this for routine updates. Use deploy.sh for major updates.

set -e

echo "🚀 Quick Deploy - HaloPSA Reporting Dashboard"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "✗ ERROR: .env file not found!"
    echo "Docker Compose needs the .env file to inject environment variables."
    echo "Please create a .env file in the project root directory."
    echo "You can copy .env.example: cp .env.example .env"
    exit 1
fi
echo "✓ .env file found"
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
