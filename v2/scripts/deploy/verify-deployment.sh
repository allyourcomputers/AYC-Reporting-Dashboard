#!/bin/bash
# Verify production deployment

set -e

echo "=========================================="
echo "Deployment Verification"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_pass() {
  echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
}

check_warn() {
  echo -e "${YELLOW}!${NC} $1"
}

# Check required environment variables
echo "Checking environment variables..."
echo ""

if [ -z "$VITE_CONVEX_URL" ]; then
  check_fail "VITE_CONVEX_URL is not set"
else
  check_pass "VITE_CONVEX_URL is set: $VITE_CONVEX_URL"
fi

if [ -z "$VITE_CLERK_PUBLISHABLE_KEY" ]; then
  check_fail "VITE_CLERK_PUBLISHABLE_KEY is not set"
else
  if [[ "$VITE_CLERK_PUBLISHABLE_KEY" == pk_live_* ]]; then
    check_pass "VITE_CLERK_PUBLISHABLE_KEY is set (production key)"
  elif [[ "$VITE_CLERK_PUBLISHABLE_KEY" == pk_test_* ]]; then
    check_warn "VITE_CLERK_PUBLISHABLE_KEY is set (TEST key - use pk_live_ for production)"
  else
    check_fail "VITE_CLERK_PUBLISHABLE_KEY has unexpected format"
  fi
fi

echo ""
echo "Checking build..."

# Run build
if npm run build &>/dev/null; then
  check_pass "Build completed successfully"
else
  check_fail "Build failed"
  exit 1
fi

echo ""
echo "Checking Convex deployment..."

# Check Convex connection
if npx convex function-spec &>/dev/null; then
  check_pass "Convex functions are accessible"
else
  check_warn "Could not verify Convex functions (may need to deploy first)"
fi

echo ""
echo "=========================================="
echo "Verification complete"
echo "=========================================="
echo ""
echo "Manual checks required:"
echo "  1. Sign in to the application"
echo "  2. Verify dashboard loads with data"
echo "  3. Test server/workstation pages"
echo "  4. Verify admin sync works"
echo "  5. Check scheduled jobs in Convex dashboard"
echo ""
