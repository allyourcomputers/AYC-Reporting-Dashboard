#!/bin/bash
# Deploy HaloPSA Reporting Dashboard v2 with Docker

set -e

echo "=========================================="
echo "HaloPSA Reporting Dashboard v2 Deployment"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check required environment variables
check_env() {
    if [ -z "${!1}" ]; then
        echo -e "${RED}Error: $1 is not set${NC}"
        echo "Please set $1 before running this script"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} $1 is set"
}

echo "Checking environment variables..."
check_env "VITE_CONVEX_URL"
check_env "VITE_CLERK_PUBLISHABLE_KEY"
echo ""

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_DIR"

# Stop existing container if running
echo "Stopping existing container (if running)..."
docker compose down 2>/dev/null || true
echo ""

# Build and start the container
echo "Building and starting container..."
docker compose build --no-cache
docker compose up -d

echo ""
echo "=========================================="
echo -e "${GREEN}Deployment complete!${NC}"
echo "=========================================="
echo ""
echo "Container: halo-reporting-v2"
echo "Port: ${PORT:-3200}"
echo ""
echo "Check status with:"
echo "  docker compose ps"
echo "  docker compose logs -f"
echo ""
echo "Health check:"
echo "  curl http://localhost:${PORT:-3200}/health"
echo ""
