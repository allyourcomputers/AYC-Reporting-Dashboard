# Production Deployment Guide

This guide covers deploying the HaloPSA Reporting Dashboard to production.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel/CDN    │────▶│     Convex      │────▶│  External APIs  │
│  (Frontend)     │     │   (Backend)     │     │  NinjaOne/Halo  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│     Clerk       │     │   Clerk JWT     │
│  (Auth UI)      │     │  (Validation)   │
└─────────────────┘     └─────────────────┘
```

## Prerequisites

1. [Convex](https://convex.dev) account
2. [Clerk](https://clerk.com) account
3. [Vercel](https://vercel.com) account (recommended) or other static hosting
4. API credentials for: NinjaOne, HaloPSA, 20i

## Step 1: Clerk Production Setup

### 1.1 Create Production Instance

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application or use existing
3. Switch to **Production** mode

### 1.2 Configure Production Settings

1. **Allowed Origins**: Add your production domain (e.g., `https://dashboard.yourcompany.com`)
2. **JWT Templates**: Ensure "convex" template is configured (same as development)
3. Copy the **Publishable Key** (starts with `pk_live_`)
4. Copy the **JWT Issuer Domain** (e.g., `https://clerk.yourcompany.com`)

### 1.3 Configure Social Logins (Optional)

For production, configure OAuth with your own credentials:
- Google OAuth: [console.cloud.google.com](https://console.cloud.google.com)
- Microsoft OAuth: [portal.azure.com](https://portal.azure.com)

## Step 2: Convex Production Deployment

### 2.1 Create Production Deployment

```bash
# Login to Convex
npx convex login

# Create production deployment
npx convex deploy --prod
```

This creates a production deployment and outputs the production URL.

### 2.2 Configure Environment Variables

In Convex Dashboard > Settings > Environment Variables, add:

| Variable | Value | Description |
|----------|-------|-------------|
| `CLERK_JWT_ISSUER_DOMAIN` | `https://clerk.yourcompany.com` | Clerk JWT issuer |
| `NINJA_CLIENT_ID` | Your NinjaOne client ID | NinjaOne OAuth |
| `NINJA_CLIENT_SECRET` | Your NinjaOne client secret | NinjaOne OAuth |
| `NINJA_BASE_URL` | `https://app.ninjarmm.com` | NinjaOne API URL |
| `HALO_API_URL` | `https://your.halopsa.com/api` | HaloPSA API URL |
| `HALO_CLIENT_ID` | Your HaloPSA client ID | HaloPSA OAuth |
| `HALO_CLIENT_SECRET` | Your HaloPSA client secret | HaloPSA OAuth |
| `TWENTYI_API_KEY` | Your 20i API key | 20i authentication |

### 2.3 Verify Deployment

```bash
# Check deployment status
npx convex dashboard
```

## Step 3: Frontend Deployment (Vercel)

### 3.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" > "Project"
3. Import your Git repository
4. Set **Root Directory** to `v2` (if using monorepo structure)

### 3.2 Configure Build Settings

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### 3.3 Configure Environment Variables

In Vercel > Project Settings > Environment Variables:

| Variable | Value |
|----------|-------|
| `VITE_CONVEX_URL` | Your Convex production URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Your Clerk production publishable key |

### 3.4 Deploy

Click "Deploy" or push to your main branch for automatic deployment.

## Step 4: Data Migration

### 4.1 Export from Supabase

```bash
# Set environment variables
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Run export
node scripts/migration/export-supabase.mjs
```

### 4.2 Sync External Data

Before importing, sync data from external APIs:

1. Access your production app
2. Sign in as super_admin
3. Navigate to /admin/sync
4. Run "Full Sync All"

This populates:
- HaloPSA clients, tickets, feedback
- 20i domains

### 4.3 Import to Convex

```bash
# Set Convex production URL
export CONVEX_URL=https://your-production.convex.cloud

# Run import
node scripts/migration/import-to-convex.mjs
```

### 4.4 Verify Migration

1. Check companies in /admin/companies
2. Verify user access
3. Test company switching

## Step 5: DNS & SSL

### 5.1 Custom Domain (Vercel)

1. Vercel > Project Settings > Domains
2. Add your domain (e.g., `dashboard.yourcompany.com`)
3. Configure DNS as instructed

### 5.2 Custom Domain (Clerk)

1. Clerk Dashboard > Domains
2. Add production domain
3. Configure DNS records

## Step 6: Post-Deployment Checklist

- [ ] Verify Clerk authentication works
- [ ] Test super_admin login
- [ ] Verify company switching
- [ ] Test NinjaOne servers/workstations pages
- [ ] Test HaloPSA ticket sync
- [ ] Test 20i domains sync
- [ ] Verify reports page with date filtering
- [ ] Test PDF/CSV export
- [ ] Verify scheduled sync jobs running (check Convex dashboard)
- [ ] Test impersonation feature
- [ ] Verify domain assignments

## Monitoring

### Convex Dashboard

Monitor your deployment at [dashboard.convex.dev](https://dashboard.convex.dev):
- Function logs
- Scheduled job status
- Error tracking
- Usage metrics

### Clerk Dashboard

Monitor authentication at [dashboard.clerk.com](https://dashboard.clerk.com):
- Sign-in attempts
- Active users
- Security events

## Rollback Procedures

### Frontend Rollback (Vercel)

1. Go to Vercel > Project > Deployments
2. Find previous working deployment
3. Click "..." > "Promote to Production"

### Backend Rollback (Convex)

```bash
# List deployments
npx convex deployments list

# Rollback to specific deployment
npx convex deploy --push-from <deployment-name>
```

## Troubleshooting

### "Unauthorized" errors

- Check Clerk JWT issuer domain in Convex env vars
- Verify Clerk publishable key matches environment
- Ensure user has correct role in database

### External API failures

- Verify API credentials in Convex environment variables
- Check API rate limits
- Verify network connectivity from Convex

### Sync not running

- Check Convex dashboard for cron job status
- Verify scheduled functions are enabled
- Check function logs for errors

## Security Considerations

1. **Never commit `.env.local`** - Contains secrets
2. **Use Clerk production mode** - Enables security features
3. **Rotate API keys periodically** - Update in Convex dashboard
4. **Monitor access logs** - Check Clerk and Convex dashboards
5. **Enable 2FA** - For admin accounts in Clerk
