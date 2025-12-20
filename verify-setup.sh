#!/bin/bash
# Verify deployment setup for HaloPSA Reporting Dashboard

set -e

echo "======================================"
echo "HaloPSA Reporting - Setup Verification"
echo "======================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

# Check 1: .env file exists
echo "1. Checking .env file..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"

    # Check if it has content
    if [ -s ".env" ]; then
        echo -e "${GREEN}✓${NC} .env file is not empty"

        # Check for required variables
        echo ""
        echo "2. Checking required environment variables in .env..."

        check_var() {
            if grep -q "^$1=" .env && ! grep -q "^$1=your-" .env && ! grep -q "^$1=$" .env; then
                echo -e "${GREEN}✓${NC} $1 is set"
            else
                echo -e "${RED}✗${NC} $1 is missing or uses placeholder value"
                ERRORS=$((ERRORS + 1))
            fi
        }

        check_var "HALO_API_URL"
        check_var "HALO_CLIENT_ID"
        check_var "HALO_CLIENT_SECRET"
        check_var "SUPABASE_URL"
        check_var "SUPABASE_KEY"

    else
        echo -e "${RED}✗${NC} .env file is empty"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} .env file not found"
    echo "  Run: cp .env.example .env"
    echo "  Then edit .env and add your actual credentials"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "3. Checking Docker setup..."

# Check if docker-compose.yml exists
if [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}✓${NC} docker-compose.yml exists"
else
    echo -e "${RED}✗${NC} docker-compose.yml not found"
    ERRORS=$((ERRORS + 1))
fi

# Check if Dockerfile exists
if [ -f "Dockerfile" ]; then
    echo -e "${GREEN}✓${NC} Dockerfile exists"
else
    echo -e "${RED}✗${NC} Dockerfile not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "4. Checking deployment scripts..."

# Check if deployment scripts exist and are executable
check_script() {
    if [ -f "$1" ]; then
        if [ -x "$1" ]; then
            echo -e "${GREEN}✓${NC} $1 exists and is executable"
        else
            echo -e "${YELLOW}!${NC} $1 exists but is not executable"
            echo "  Run: chmod +x $1"
        fi
    else
        echo -e "${YELLOW}!${NC} $1 not found (optional)"
    fi
}

check_script "deploy.sh"
check_script "quick-deploy.sh"

echo ""
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "You can now run:"
    echo "  ./deploy.sh       (full deployment)"
    echo "  ./quick-deploy.sh (quick deployment)"
else
    echo -e "${RED}✗ Found $ERRORS error(s)${NC}"
    echo ""
    echo "Please fix the errors above before deploying."
fi
echo "======================================"
echo ""
