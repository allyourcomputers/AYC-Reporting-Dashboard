# Authentication Setup Guide

Your HaloPSA reporting dashboard now requires authentication to access. This guide will help you set up users in Supabase.

## Prerequisites

- Supabase project already configured (with `SUPABASE_URL` and `SUPABASE_KEY` in `.env`)
- Access to your Supabase dashboard

## Step 1: Enable Email Authentication in Supabase

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **Authentication** > **Providers**
3. Ensure **Email** provider is enabled
4. Configure email settings (you can use the default development settings for testing)

## Step 2: Create Your First User

### Option A: Using Supabase Dashboard (Recommended)

1. In your Supabase dashboard, go to **Authentication** > **Users**
2. Click **Add User** or **Invite User**
3. Choose **Create new user**
4. Enter the user's email address
5. Enter a password (or auto-generate one)
6. Click **Create User**

### Option B: Using the Application (After First User)

Once you have at least one user created in Supabase:
1. Visit your application's login page: `http://localhost:3000/login`
2. Enter the email and password you created
3. Click **Sign In**

## Step 3: Test the Authentication

1. Start your server: `npm start`
2. Navigate to `http://localhost:3000`
3. You should be redirected to the login page
4. Enter your credentials and sign in
5. You should now see the dashboard

## Managing Users

### Add More Users

To add additional users, repeat Step 2 above.

### Reset a User's Password

1. In Supabase dashboard, go to **Authentication** > **Users**
2. Find the user and click the **...** menu
3. Select **Reset Password**
4. The user will receive a password reset email

### Delete a User

1. In Supabase dashboard, go to **Authentication** > **Users**
2. Find the user and click the **...** menu
3. Select **Delete User**

## Features Implemented

✅ **Login Page** - Professional login interface at `/login`
✅ **Protected Routes** - All API endpoints require authentication
✅ **Session Management** - Automatic session handling with Supabase
✅ **Logout Functionality** - Sign out button in the sidebar
✅ **User Display** - Shows logged-in user's email in the sidebar

## Troubleshooting

### Can't Access Login Page

- Ensure your server is running: `npm start`
- Check that Supabase credentials are correct in `.env`
- Verify the `/api/config` endpoint returns Supabase URL and anon key

### Login Fails

- Check that the user exists in Supabase dashboard
- Verify the password is correct
- Check browser console for specific error messages
- Ensure email confirmation is not required (or the user's email is confirmed)

### Redirected to Login After Signing In

- Check browser console for errors
- Verify Supabase JWT token is being stored (check Application > Local Storage in DevTools)
- Ensure the server is properly validating tokens

## Security Notes

- Never commit your `.env` file to version control
- The `SUPABASE_KEY` in `.env` is your anon/public key (safe for client-side use)
- User passwords are securely hashed by Supabase
- JWT tokens expire automatically and are validated on each API request
- All pages except `/login` redirect to the login page if not authenticated

## Next Steps

Consider enabling additional security features in Supabase:
- **Email Confirmation** - Require users to verify their email
- **Multi-Factor Authentication** - Add an extra layer of security
- **Password Requirements** - Set minimum password complexity
- **Rate Limiting** - Prevent brute force attacks

These can be configured in your Supabase dashboard under **Authentication** > **Settings**.
