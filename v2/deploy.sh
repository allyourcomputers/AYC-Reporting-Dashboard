#!/bin/bash
# Deployment script for HaloPSA Reporting Dashboard v2
# This script updates the application with the latest code from GitHub,
# deploys Convex functions, and rebuilds the Docker container

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Header
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  HaloPSA Reporting Dashboard v2 - Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if running in the correct directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found!"
    print_error "Please run this script from the v2 project directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_error "Docker Compose needs the .env file for build arguments."
    echo ""
    echo "Create .env with:"
    echo "  cp .env.production .env"
    echo ""
    echo "Required variables:"
    echo "  VITE_CONVEX_URL=https://your-project.convex.cloud"
    echo "  PORT=3200"
    echo ""
    echo "Also set these in Convex Dashboard > Settings > Environment Variables:"
    echo "  AUTH_SECRET        (openssl rand -base64 32)"
    echo "  JWT_PRIVATE_KEY    (RSA PKCS#8 private key)"
    echo "  SITE_URL           (your production URL)"
    exit 1
fi
print_success ".env file found"

# Check required environment variables
source .env
if [ -z "$VITE_CONVEX_URL" ]; then
    print_error "VITE_CONVEX_URL not set in .env"
    exit 1
fi
print_success "Environment variables verified"
echo ""

# Check if npx/convex is available for deployment
if ! command -v npx &> /dev/null; then
    print_warning "npx not found - will skip Convex function deployment"
    print_warning "Run 'npx convex deploy' manually to update Convex functions"
    SKIP_CONVEX_DEPLOY=true
else
    SKIP_CONVEX_DEPLOY=false
fi

print_status "Starting deployment process..."
echo ""

# Step 1: Check for uncommitted changes
print_status "Checking for local changes..."
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    print_warning "You have uncommitted changes in your working directory."
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled."
        exit 1
    fi
fi
print_success "Working directory check complete"
echo ""

# Step 2: Stop the running container
print_status "Stopping Docker container..."
if docker compose down 2>/dev/null; then
    print_success "Container stopped successfully"
else
    print_warning "No container was running (or docker compose not available)"
fi
echo ""

# Step 3: Pull latest code from GitHub
print_status "Pulling latest code from GitHub..."
BRANCH=$(git rev-parse --abbrev-ref HEAD)
print_status "Current branch: $BRANCH"

if git pull origin "$BRANCH"; then
    print_success "Code updated successfully"
else
    print_error "Failed to pull latest code"
    print_warning "Attempting to restart with existing code..."
    docker compose up -d
    exit 1
fi
echo ""

# Step 4: Deploy Convex functions
if [ "$SKIP_CONVEX_DEPLOY" = false ]; then
    print_status "Deploying Convex functions to production..."
    print_warning "This updates your backend schema and functions..."

    if npx convex deploy --yes; then
        print_success "Convex functions deployed successfully"
    else
        print_error "Failed to deploy Convex functions"
        print_warning "Check that Convex Auth env vars are set in Convex Dashboard:"
        echo "  - AUTH_SECRET"
        echo "  - JWT_PRIVATE_KEY (RSA PKCS#8 format)"
        echo "  - SITE_URL"
        echo ""
        read -p "Continue with Docker deployment anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled."
            exit 1
        fi
    fi
    echo ""
fi

# Step 5: Rebuild Docker image
print_status "Rebuilding Docker image..."
print_warning "This may take a few minutes..."
if docker compose build --no-cache; then
    print_success "Image rebuilt successfully"
else
    print_error "Failed to rebuild image"
    print_warning "Attempting to restart with old image..."
    docker compose up -d
    exit 1
fi
echo ""

# Step 6: Start the container
print_status "Starting Docker container..."
if docker compose up -d; then
    print_success "Container started successfully"
else
    print_error "Failed to start container"
    exit 1
fi
echo ""

# Step 7: Wait for container to be healthy
print_status "Waiting for container to be healthy..."
CONTAINER_NAME="halo-reporting-v2"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker ps --filter "name=$CONTAINER_NAME" --filter "health=healthy" | grep -q "$CONTAINER_NAME"; then
        print_success "Container is healthy"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        print_warning "Container health check timed out, checking if running..."
        if docker ps | grep -q "$CONTAINER_NAME"; then
            print_success "Container is running (health check may still be in progress)"
        else
            print_error "Container is not running!"
            print_status "Showing container logs:"
            docker logs "$CONTAINER_NAME" --tail 50
            exit 1
        fi
    fi
    sleep 2
done
echo ""

# Step 8: Display status
print_status "Deployment Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker compose ps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show current git commit
print_status "Current version:"
echo "  Commit:  $(git rev-parse --short HEAD)"
echo "  Message: $(git log -1 --pretty=%B | head -1)"
echo "  Author:  $(git log -1 --pretty=%an)"
echo "  Date:    $(git log -1 --pretty=%ad --date=relative)"
echo ""

# Show access info
PORT=${PORT:-3200}
print_success "Deployment completed successfully!"
echo ""
print_status "Access the application:"
echo "  Local:   http://localhost:$PORT"
echo "  Health:  http://localhost:$PORT/health"
echo ""
print_status "Useful commands:"
echo "  View logs:     docker compose logs -f"
echo "  Check status:  docker compose ps"
echo "  Stop:          docker compose down"
echo "  Restart:       docker compose restart"
echo ""
print_status "Convex backend:"
echo "  Dashboard:     https://dashboard.convex.dev"
echo "  Convex URL:    $VITE_CONVEX_URL"
echo ""
print_status "First-time setup (if no users exist):"
echo "  npx convex run users:bootstrap '{\"email\": \"admin@example.com\", \"name\": \"Admin\", \"password\": \"SecurePassword123\"}'"
echo ""
print_warning "Remember: AUTH_SECRET, JWT_PRIVATE_KEY, and SITE_URL must be set in Convex Dashboard!"
echo ""
