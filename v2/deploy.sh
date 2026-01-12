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

# Extract deployment name from VITE_CONVEX_URL and set CONVEX_DEPLOYMENT
# URL format: https://festive-boar-373.convex.cloud -> festive-boar-373
DEPLOYMENT_NAME=$(echo "$VITE_CONVEX_URL" | sed -E 's|https://([^.]+)\.convex\.cloud.*|\1|')
if [ -z "$DEPLOYMENT_NAME" ]; then
    print_error "Could not extract deployment name from VITE_CONVEX_URL"
    exit 1
fi
export CONVEX_DEPLOYMENT="$DEPLOYMENT_NAME"
print_success "Convex deployment: $DEPLOYMENT_NAME"
echo ""

# Check if npx/convex is available for deployment
if ! command -v npx &> /dev/null; then
    print_error "npx not found - required for Convex deployment"
    print_error "Please install Node.js and npm"
    exit 1
fi

# Check for convex directory to ensure we're in the right location
if [ ! -d "convex" ]; then
    print_error "convex directory not found - are you in the v2 directory?"
    exit 1
fi
print_success "Convex directory found"

# Function to check if a Convex env var is set
check_convex_env() {
    local var_name=$1
    # Run convex env get and capture output
    local result
    result=$(npx convex env get "$var_name" 2>&1)
    local exit_code=$?

    # Check for errors that indicate authentication issues
    if [[ "$result" == *"Not logged in"* ]] || [[ "$result" == *"authenticate"* ]]; then
        print_error "Convex CLI not authenticated"
        print_warning "Please run: npx convex login"
        exit 1
    fi

    # Check if the result indicates the var is not set
    if [ $exit_code -ne 0 ] || [ -z "$result" ] || [ "$result" = "undefined" ] || [[ "$result" == *"not set"* ]] || [[ "$result" == *"does not exist"* ]] || [[ "$result" == *"No environment variable"* ]]; then
        return 1  # Not set
    fi
    return 0  # Set
}

# Function to set Convex env var
set_convex_env() {
    local var_name=$1
    local var_value=$2
    npx convex env set "$var_name" "$var_value" 2>&1
}

# Setup Convex Auth environment variables
print_status "Checking Convex Auth environment variables..."
echo ""

# Check and set AUTH_SECRET
if check_convex_env "AUTH_SECRET"; then
    print_success "AUTH_SECRET is already set"
else
    print_warning "AUTH_SECRET not set - generating..."
    AUTH_SECRET=$(openssl rand -base64 32)
    if set_convex_env "AUTH_SECRET" "$AUTH_SECRET"; then
        print_success "AUTH_SECRET generated and set"
    else
        print_error "Failed to set AUTH_SECRET"
        exit 1
    fi
fi

# Check and set JWT_PRIVATE_KEY
if check_convex_env "JWT_PRIVATE_KEY"; then
    print_success "JWT_PRIVATE_KEY is already set"
else
    print_warning "JWT_PRIVATE_KEY not set - generating RSA key..."
    # Generate RSA PKCS#8 key and convert newlines to \n for storage
    JWT_PRIVATE_KEY=$(openssl genpkey -algorithm RSA -pkcs8 2>/dev/null | awk '{printf "%s\\n", $0}')
    if set_convex_env "JWT_PRIVATE_KEY" "$JWT_PRIVATE_KEY"; then
        print_success "JWT_PRIVATE_KEY generated and set"
    else
        print_error "Failed to set JWT_PRIVATE_KEY"
        exit 1
    fi
fi

# Check and set SITE_URL
if check_convex_env "SITE_URL"; then
    print_success "SITE_URL is already set"
else
    print_warning "SITE_URL not set"
    echo ""
    echo "SITE_URL is your production frontend URL (e.g., https://reports.example.com)"
    echo "This is used for password reset emails and auth callbacks."
    echo ""
    read -p "Enter your production URL: " SITE_URL
    if [ -z "$SITE_URL" ]; then
        print_error "SITE_URL is required"
        exit 1
    fi
    if set_convex_env "SITE_URL" "$SITE_URL"; then
        print_success "SITE_URL set to: $SITE_URL"
    else
        print_error "Failed to set SITE_URL"
        exit 1
    fi
fi
echo ""

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

# Step 4: Install dependencies
print_status "Installing npm dependencies..."
if npm install --omit=dev 2>&1; then
    print_success "Dependencies installed successfully"
else
    print_warning "npm install had warnings (continuing anyway)"
fi
echo ""

# Step 5: Deploy Convex functions
print_status "Deploying Convex functions to production..."
print_warning "This updates your backend schema and functions..."

if npx convex deploy --yes; then
    print_success "Convex functions deployed successfully"
else
    print_error "Failed to deploy Convex functions"
    read -p "Continue with Docker deployment anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled."
        exit 1
    fi
fi
echo ""

# Step 6: Rebuild Docker image
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

# Step 7: Start the container
print_status "Starting Docker container..."
if docker compose up -d; then
    print_success "Container started successfully"
else
    print_error "Failed to start container"
    exit 1
fi
echo ""

# Step 8: Wait for container to be healthy
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

# Step 9: Check if bootstrap user is needed
print_status "Checking if bootstrap user is needed..."
USER_COUNT=$(npx convex run migration:getAllUsers '{}' 2>/dev/null | grep -c "_id" || echo "0")
if [ "$USER_COUNT" = "0" ]; then
    print_warning "No users found in database - bootstrap required"
    echo ""
    echo "Create the first admin user:"
    read -p "  Email: " ADMIN_EMAIL
    read -p "  Name: " ADMIN_NAME
    read -sp "  Password: " ADMIN_PASSWORD
    echo ""

    if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_NAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
        print_status "Creating admin user..."
        if npx convex run users:bootstrap "{\"email\": \"$ADMIN_EMAIL\", \"name\": \"$ADMIN_NAME\", \"password\": \"$ADMIN_PASSWORD\"}"; then
            print_success "Admin user created: $ADMIN_EMAIL"
        else
            print_error "Failed to create admin user"
            print_warning "You can create one manually later with:"
            echo "  npx convex run users:bootstrap '{\"email\": \"admin@example.com\", \"name\": \"Admin\", \"password\": \"SecurePassword\"}'"
        fi
    else
        print_warning "Skipping bootstrap - you can create a user later with:"
        echo "  npx convex run users:bootstrap '{\"email\": \"admin@example.com\", \"name\": \"Admin\", \"password\": \"SecurePassword\"}'"
    fi
else
    print_success "Users already exist in database"
fi
echo ""

# Step 10: Display status
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
