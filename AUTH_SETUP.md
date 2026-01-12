# Authentication Setup Guide (v2)

This guide covers authentication setup for the React + Convex version (v2) of the HaloPSA Reporting Dashboard.

## Overview

v2 uses **Convex Auth** with email/password authentication. This means:
- No external auth providers (Clerk, Auth0, Supabase Auth)
- Users are created directly in the admin panel
- Admins set initial passwords for users
- Users sign in immediately with their credentials

## Prerequisites

- Convex project deployed
- Environment variables configured in Convex Dashboard

## Required Environment Variables

Set these in **Convex Dashboard > Settings > Environment Variables**:

| Variable | Description | How to Generate |
|----------|-------------|-----------------|
| `AUTH_SECRET` | Session encryption key | `openssl rand -base64 32` |
| `JWT_PRIVATE_KEY` | RSA private key for JWT signing | See below |
| `SITE_URL` | Your production URL | e.g., `https://reports.example.com` |

### Generating JWT_PRIVATE_KEY

The JWT_PRIVATE_KEY must be an RSA private key in PKCS#8 format:

```bash
# Generate the key
openssl genpkey -algorithm RSA -pkcs8

# Output will look like:
# -----BEGIN PRIVATE KEY-----
# MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
# ... (many lines of base64)
# -----END PRIVATE KEY-----
```

Copy the **entire output** including the BEGIN and END markers into Convex Dashboard.

## First-Time Setup

### Option 1: Using deploy.sh (Recommended)

The `deploy.sh` script handles everything automatically:

```bash
./deploy.sh
```

On first run, it will:
1. Generate and set `AUTH_SECRET` automatically
2. Generate and set `JWT_PRIVATE_KEY` automatically
3. Prompt you for `SITE_URL`
4. Deploy Convex functions
5. Prompt you to create the first admin user

### Option 2: Manual Setup

1. **Set environment variables** in Convex Dashboard (see above)

2. **Deploy Convex functions**:
   ```bash
   npx convex deploy
   ```

3. **Bootstrap the first admin user**:
   ```bash
   npx convex run users:bootstrap '{"email": "admin@example.com", "name": "Admin User", "password": "SecurePassword123"}'
   ```

   This creates a `super_admin` user who can then create other users.

## Creating Additional Users

Once you have a super_admin account:

1. Sign in to the application
2. Navigate to **Admin > Users**
3. Click **Add User**
4. Fill in the form:
   - **Email**: User's email address (used for sign-in)
   - **Name**: Display name
   - **Password**: Initial password (user should change after first login)
   - **Role**: Select `super_admin`, `admin`, or `customer`
   - **Companies**: Assign companies the user can access
5. Click **Create User**

The user can immediately sign in with the provided credentials.

## User Roles

| Role | Capabilities |
|------|--------------|
| `super_admin` | Full access to all data, can impersonate users, manage all companies |
| `admin` | Manage data for assigned companies |
| `customer` | View-only access to assigned companies |

## Features

### Impersonation (Super Admin Only)

Super admins can impersonate other users to debug issues:

1. Go to **Admin > Users**
2. Click **Impersonate** next to the target user
3. A warning banner appears showing you're impersonating
4. Click **Stop Impersonation** to return to your account

### Company Switching

Users assigned to multiple companies can switch between them:

1. Click the company selector in the header
2. Select the company to view
3. All data is filtered to that company

## Sign-In Flow

1. User visits the application
2. If not authenticated, redirected to `/sign-in`
3. User enters email and password
4. On success, redirected to dashboard
5. Session persists until sign-out or expiry

## Troubleshooting

### "Missing environment variable JWT_PRIVATE_KEY"

The `JWT_PRIVATE_KEY` is not set in Convex Dashboard. Generate one with:

```bash
openssl genpkey -algorithm RSA -pkcs8 2>/dev/null
```

### "pkcs8 must be PKCS#8 formatted string"

You set a random string instead of a proper RSA key. Use the command above to generate a valid key.

### "PrivateKeyInfo algorithm is not rsaEncryption"

You generated a key with the wrong algorithm (e.g., Ed25519). Use RSA specifically:

```bash
openssl genpkey -algorithm RSA -pkcs8
```

### "Sign in failed" with no error

1. Check Convex Dashboard logs for errors
2. Verify `AUTH_SECRET`, `JWT_PRIVATE_KEY`, and `SITE_URL` are all set
3. Redeploy Convex functions: `npx convex deploy`

### "User not found" after sign-in

The user was created in Convex but the auth account wasn't linked. This can happen if:
- User was migrated from old system without creating auth credentials
- There was an error during user creation

Solution: Delete and recreate the user through the admin panel.

### Can't create users - "Not authenticated"

You're not signed in as a super_admin. Only super_admins can create users.

## Security Notes

- Passwords are hashed using bcrypt by Convex Auth
- Sessions use JWT tokens signed with your RSA private key
- Never share or commit your `JWT_PRIVATE_KEY`
- `AUTH_SECRET` and `JWT_PRIVATE_KEY` should be different values
- All API endpoints require authentication

## Password Reset (Future)

Currently, admins must set new passwords for users. Password reset via email can be added by:
1. Setting `SITE_URL` correctly for email links
2. Implementing the password reset flow in the UI
3. Using Convex Auth's built-in reset functionality

---

## Migration from v1 (Supabase)

If migrating from the Supabase version:

1. **Users are NOT migrated automatically** - Users must be recreated
2. Run the data migration script to transfer companies, tickets, etc.
3. Create new user accounts with initial passwords
4. Notify users of their new credentials

The `v2/scripts/migrate-from-supabase.ts` script can help migrate data (excluding auth).
