#!/bin/bash
# Deployment script for HaloPSA Reporting Dashboard
# This script updates the application with the latest code from GitHub

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

# Check if running in the correct directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found!"
    print_error "Please run this script from the project root directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_error "Docker Compose needs the .env file to inject environment variables."
    print_error "Please create a .env file in the project root directory."
    print_error "You can copy .env.example: cp .env.example .env"
    exit 1
fi
print_success ".env file found"

print_status "Starting deployment process..."
echo ""

# Step 1: Check for uncommitted changes
print_status "Checking for local changes..."
if ! git diff-index --quiet HEAD --; then
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
if docker-compose down; then
    print_success "Container stopped successfully"
else
    print_error "Failed to stop container"
    exit 1
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
    docker-compose up -d
    exit 1
fi
echo ""

# Step 4: Rebuild Docker image
print_status "Rebuilding Docker image..."
print_warning "This may take a few minutes..."
if docker-compose build --no-cache; then
    print_success "Image rebuilt successfully"
else
    print_error "Failed to rebuild image"
    print_warning "Attempting to restart with old image..."
    docker-compose up -d
    exit 1
fi
echo ""

# Step 5: Start the container
print_status "Starting Docker container..."
if docker-compose up -d; then
    print_success "Container started successfully"
else
    print_error "Failed to start container"
    exit 1
fi
echo ""

# Step 6: Wait for container to be healthy
print_status "Waiting for container to be healthy..."
sleep 5

# Check if container is running
if docker ps | grep -q halo-reporting; then
    print_success "Container is running"
else
    print_error "Container is not running!"
    print_status "Showing container logs:"
    docker logs halo-reporting --tail 50
    exit 1
fi
echo ""

# Step 7: Display status
print_status "Deployment Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker-compose ps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show recent logs
print_status "Recent logs:"
docker logs halo-reporting --tail 20
echo ""

# Show current git commit
print_status "Current version:"
echo "Commit: $(git rev-parse --short HEAD)"
echo "Message: $(git log -1 --pretty=%B | head -1)"
echo "Author: $(git log -1 --pretty=%an)"
echo "Date: $(git log -1 --pretty=%ad --date=relative)"
echo ""

print_success "Deployment completed successfully!"
echo ""
print_status "Useful commands:"
echo "  View logs:        docker-compose logs -f"
echo "  Check status:     docker-compose ps"
echo "  View sync logs:   docker exec -it halo-reporting tail -f /var/log/sync.log"
echo ""
