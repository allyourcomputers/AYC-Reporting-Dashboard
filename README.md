# HaloPSA Reporting Dashboard

A web-based reporting dashboard for HaloPSA that displays ticket statistics and monthly usage reports, with Supabase integration for improved performance.

## Features

- **Supabase Authentication** - Secure login/logout with JWT tokens
- **Active Client Filtering** - Only shows clients with tickets in the last 12 months
- View ticket statistics for selected time periods
- Generate monthly reports showing:
  - Total tickets logged
  - Tickets closed
  - Open tickets
  - Close rate percentage
- Select custom date ranges (month by month)
- **Fast Performance** - Data cached in Supabase for instant queries
- Beautiful, responsive UI
- **CSV & PDF Export** - Download reports for offline analysis

## Deployment Options

### Option 1: Docker (Recommended)

**Quick Start:**
```bash
# Configure environment
cp .env.example .env
nano .env

# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for complete Docker deployment guide.

### Option 2: Production with PM2

See [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md) for PM2 deployment guide.

### Option 3: Development Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your HaloPSA and Supabase credentials:
```
HALO_API_URL=https://your-domain.halopsa.com/api
HALO_CLIENT_ID=your-client-id
HALO_CLIENT_SECRET=your-client-secret

SUPABASE_URL=http://your-supabase-url:8000
SUPABASE_KEY=your-supabase-anon-key

PORT=3000
```

3. Set up the Supabase database:
   - Run the SQL in `setup-database.sql` in your Supabase SQL editor
   - See `SUPABASE_SETUP.md` for detailed instructions

4. Sync data from HaloPSA to Supabase:
```bash
npm run sync
```

This will fetch all clients and tickets from the last 12 months.

5. Start the server:
```bash
npm start
```

6. Open your browser and navigate to:
```
http://localhost:3000
```

You will be redirected to the login page.

## Authentication Setup

The application requires authentication to access. To set up users:

1. Go to your Supabase dashboard: https://app.supabase.com
2. Navigate to **Authentication** > **Users**
3. Click **Add User** and create user accounts
4. Users can then log in with their email and password

See [AUTH_SETUP.md](AUTH_SETUP.md) for detailed authentication setup guide.

## Data Synchronization

To keep your data fresh, periodically run:
```bash
npm run sync
```

Or trigger a sync via the API:
```bash
curl -X POST http://localhost:3000/api/sync
```

For automated syncing, set up a cron job (see `SUPABASE_SETUP.md`).

## Usage

1. Select a client from the dropdown menu
2. Choose a start month and end month for your report
3. Click "Generate Report" to view statistics
4. The dashboard will display:
   - Total statistics across all selected months
   - Monthly breakdown table with detailed metrics

## API Endpoints

### GET /api/clients
Returns a list of active clients (clients with tickets in the last 12 months) from Supabase.

### GET /api/tickets/stats
Query parameters:
- `clientId`: Client ID
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)

Returns ticket statistics for a single period.

### POST /api/tickets/monthly-stats
Request body:
```json
{
  "clientId": 123,
  "months": [
    {
      "label": "January 2024",
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    }
  ]
}
```

Returns statistics for multiple months.

### POST /api/sync
Trigger a background data sync from HaloPSA to Supabase.

### GET /api/sync/status
Check the status of recent sync operations.

## Technology Stack

- Node.js
- Express.js
- Supabase (PostgreSQL database)
- HaloPSA API
- Vanilla JavaScript (no frameworks)
- Modern CSS with flexbox/grid

## Files

### Application Files
- `server-supabase.js` - Main server (queries Supabase)
- `server.js` - Legacy server (queries HaloPSA directly)
- `sync-service.js` - Data sync utility
- `setup-database.sql` - Database schema
- `public/` - Frontend HTML/CSS/JS files
- `public/js/auth.js` - Authentication utilities

### Docker Files
- `Dockerfile` - Docker container configuration
- `docker-compose.yml` - Docker Compose orchestration
- `.dockerignore` - Files excluded from Docker build

### Documentation
- `README.md` - This file
- `SUPABASE_SETUP.md` - Supabase setup guide
- `AUTH_SETUP.md` - Authentication setup guide
- `DOCKER_DEPLOYMENT.md` - Docker deployment guide
- `PRODUCTION_SETUP.md` - PM2 production deployment guide
- `DEPLOYMENT_TROUBLESHOOTING.md` - Troubleshooting common issues

## License

ISC
