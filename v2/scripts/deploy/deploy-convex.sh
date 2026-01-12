#!/bin/bash
# Deploy Convex backend to production

set -e

echo "=========================================="
echo "Convex Production Deployment"
echo "=========================================="
echo ""

# Check if logged in
if ! npx convex whoami &>/dev/null; then
  echo "Not logged in to Convex. Running login..."
  npx convex login
fi

# Confirm deployment
echo "This will deploy the Convex backend to production."
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled."
  exit 0
fi

# Run type check first
echo ""
echo "Running type check..."
npx tsc -p convex --noEmit

# Deploy to production
echo ""
echo "Deploying to production..."
npx convex deploy --prod

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Verify environment variables are set in Convex Dashboard"
echo "2. Check function logs for any errors"
echo "3. Test authentication and API integrations"
echo ""
