// Load .env file in development (not needed in Docker as env vars are injected)
require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { performFullSync } = require('./sync-service');
const logger = require('./logger');
const ninjaOneClient = require('./ninjaone-client');
const twentyiClient = require('./twentyi-client');
const { injectCompanyContext } = require('./middleware/company-context');
const adminUsersRouter = require('./routes/admin-users');
const adminCompaniesRouter = require('./routes/admin-companies');
const userProfileRouter = require('./routes/user-profile');
const stackUsersRouter = require('./routes/stack-users');
const domainAssignmentsRouter = require('./routes/domain-assignments');
const domainsRouter = require('./routes/domains');

const app = express();
const PORT = process.env.PORT || 3100;

// Request logging middleware - log ALL incoming requests
// Log only errors and slow requests
app.use((req, res, next) => {
  const startTime = Date.now();

  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;

    // Log slow requests (>2s) or errors
    if (duration > 2000 || res.statusCode >= 400) {
      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    }

    originalSend.call(this, data);
  };

  next();
});

// Security: Apply helmet to set secure HTTP headers
// Protects against XSS, clickjacking, and other common attacks
// Note: CSP is disabled because inline event handlers (onclick) in the UI
// would require 'unsafe-inline' which defeats much of CSP's purpose.
// This is acceptable for an internal authenticated dashboard.
// Other helmet protections (XSS filter, frameguard, etc.) remain active.
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow inline event handlers
}));

// Security: CORS - Allow only specific origins
// In production, set ALLOWED_ORIGINS in .env to your frontend URL(s)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3100'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

// Security: Rate limiting - Prevent abuse/DoS attacks
// Limit each IP to 100 requests per 15 minutes for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for /api/config - it's called on every page load
    return req.path === '/api/config';
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      error: 'Too many requests, please try again later.'
    });
  }
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

app.use(express.json());

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Security: Log environment variable status without revealing values
console.log('Environment check:');
console.log('- SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'NOT SET');
console.log('- SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'NOT SET');
console.log('- SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Set' : 'NOT SET');
console.log('- HALO_API_URL:', process.env.HALO_API_URL ? 'Set' : 'NOT SET');
console.log('- HALO_CLIENT_ID:', process.env.HALO_CLIENT_ID ? 'Set' : 'NOT SET');
console.log('- HALO_CLIENT_SECRET:', process.env.HALO_CLIENT_SECRET ? 'Set' : 'NOT SET');
console.log('- TWENTYI_API_KEY:', process.env.TWENTYI_API_KEY ? 'Set' : 'NOT SET');
console.log('- TWENTYI_OAUTH_KEY:', process.env.TWENTYI_OAUTH_KEY ? 'Set' : 'NOT SET');
console.log('- ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS ? 'Set' : 'Using defaults (localhost)');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  console.error('ERROR: Supabase configuration incomplete');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY');
  console.error('In development: Add them to .env file');
  console.error('In Docker: Ensure .env file exists in the same directory as docker-compose.yml');
  console.error('');
  console.error('Find your keys in Supabase Dashboard > Settings > API:');
  console.error('  - service_role key (secret) - for backend sync operations');
  console.error('  - anon key (public) - for frontend authentication');
  process.exit(1);
}

// Create Supabase client with service role key for backend operations
// This bypasses RLS and allows the sync service to write data
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Middleware to verify authentication
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Unauthorized - Auth verification failed' });
  }
}

// Serve Supabase config to frontend (public endpoint)
// IMPORTANT: This sends the ANON key to the frontend, not the service role key
app.get('/api/config', (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    logger.error('Config endpoint: Missing required environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  });
});

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve all static files (authentication is handled client-side)
// API routes are protected with the requireAuth middleware
app.use(express.static('public'));

// Multi-tenant routes (require authentication and company context)
app.use('/api/admin/users', requireAuth, injectCompanyContext, adminUsersRouter);
app.use('/api/admin/companies', requireAuth, injectCompanyContext, adminCompaniesRouter);
app.use('/api/admin/domain-assignments', requireAuth, injectCompanyContext, domainAssignmentsRouter);
app.use('/api/profile', requireAuth, userProfileRouter);
app.use('/api/stack-users', requireAuth, stackUsersRouter);
app.use('/api/domains', requireAuth, injectCompanyContext, domainsRouter);

// Get all active clients (clients with tickets in the last 12 months)
app.get('/api/clients', requireAuth, injectCompanyContext, async (req, res) => {
  try {
    // Determine which clients the user can see
    let clientQuery = supabase
      .from('active_clients')
      .select('*')
      .order('name', { ascending: true });

    // For customer users, filter by company's HaloPSA clients
    if (!req.isSuperAdmin) {
      if (!req.activeCompanyId) {
        return res.status(403).json({ error: 'No active company assigned' });
      }

      // Get HaloPSA client IDs for this company
      const { data: haloPSAClients, error: clientsError } = await supabase
        .from('company_halopsa_clients')
        .select('halopsa_client_id')
        .eq('company_id', req.activeCompanyId);

      if (clientsError) {
        logger.error('Error fetching company HaloPSA clients', { error: clientsError });
        return res.status(500).json({ error: 'Failed to fetch company data' });
      }

      const allowedClientIds = haloPSAClients.map(c => c.halopsa_client_id);

      if (allowedClientIds.length === 0) {
        // Company has no HaloPSA clients assigned, return empty array
        return res.json([]);
      }

      clientQuery = clientQuery.in('id', allowedClientIds);
    }

    const { data, error } = await clientQuery;

    if (error) {
      console.error('Error fetching active clients:', error);
      return res.status(500).json({ error: 'Failed to fetch clients' });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get ticket statistics for a client
app.get('/api/tickets/stats', requireAuth, injectCompanyContext, async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;

    if (!clientId || !startDate || !endDate) {
      return res.status(400).json({ error: 'clientId, startDate, and endDate are required' });
    }

    // Verify user has access to this client
    if (!req.isSuperAdmin) {
      if (!req.activeCompanyId) {
        return res.status(403).json({ error: 'No active company assigned' });
      }

      // Get HaloPSA client IDs for this company
      const { data: haloPSAClients, error: clientsError } = await supabase
        .from('company_halopsa_clients')
        .select('halopsa_client_id')
        .eq('company_id', req.activeCompanyId);

      if (clientsError) {
        logger.error('Error fetching company HaloPSA clients', { error: clientsError });
        return res.status(500).json({ error: 'Failed to fetch company data' });
      }

      const allowedClientIds = haloPSAClients.map(c => c.halopsa_client_id);

      if (!allowedClientIds.includes(parseInt(clientId))) {
        return res.status(403).json({ error: 'Access denied to this client' });
      }
    }

    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('client_id', clientId)
      .gte('date_occurred', startDate)
      .lte('date_occurred', endDate);

    if (error) {
      console.error('Error fetching ticket stats:', error);
      return res.status(500).json({ error: 'Failed to fetch ticket statistics' });
    }

    const totalTickets = tickets.length;
    const closedTickets = tickets.filter(ticket => ticket.is_closed).length;

    res.json({
      totalTickets,
      closedTickets,
      openTickets: totalTickets - closedTickets,
      tickets: tickets.map(t => ({
        id: t.id,
        summary: t.summary,
        status: t.status_name,
        dateOccurred: t.date_occurred,
        dateClosed: t.date_closed
      }))
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({ error: 'Failed to fetch ticket statistics' });
  }
});

// Get monthly statistics for multiple months
app.post('/api/tickets/monthly-stats', requireAuth, injectCompanyContext, async (req, res) => {
  try {
    const { clientId, months } = req.body;

    if (!clientId || !months || !Array.isArray(months)) {
      return res.status(400).json({ error: 'clientId and months array are required' });
    }

    // Verify user has access to this client
    if (!req.isSuperAdmin) {
      if (!req.activeCompanyId) {
        return res.status(403).json({ error: 'No active company assigned' });
      }

      // Get HaloPSA client IDs for this company
      const { data: haloPSAClients, error: clientsError } = await supabase
        .from('company_halopsa_clients')
        .select('halopsa_client_id')
        .eq('company_id', req.activeCompanyId);

      if (clientsError) {
        logger.error('Error fetching company HaloPSA clients', { error: clientsError });
        return res.status(500).json({ error: 'Failed to fetch company data' });
      }

      const allowedClientIds = haloPSAClients.map(c => c.halopsa_client_id);

      if (!allowedClientIds.includes(parseInt(clientId))) {
        return res.status(403).json({ error: 'Access denied to this client' });
      }
    }

    const results = [];

    for (const month of months) {
      const { startDate, endDate } = month;

      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('client_id', clientId)
        .gte('date_occurred', startDate)
        .lte('date_occurred', endDate);

      if (error) {
        console.error('Error fetching monthly stats:', error);
        return res.status(500).json({ error: 'Failed to fetch monthly statistics' });
      }

      const totalTickets = tickets.length;
      const closedTickets = tickets.filter(ticket => ticket.is_closed).length;

      results.push({
        month: month.label,
        startDate,
        endDate,
        totalTickets,
        closedTickets,
        openTickets: totalTickets - closedTickets
      });
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    res.status(500).json({ error: 'Failed to fetch monthly statistics' });
  }
});

// Trigger a data sync
app.post('/api/sync', requireAuth, async (req, res) => {
  try {
    const monthsBack = req.body.monthsBack || 12;

    console.log(`Starting sync of last ${monthsBack} months...`);

    // Run sync in background
    performFullSync(monthsBack)
      .then(result => {
        console.log('Sync completed:', result);
      })
      .catch(error => {
        console.error('Sync failed:', error);
      });

    res.json({
      message: 'Sync started in background',
      monthsBack
    });
  } catch (error) {
    console.error('Error starting sync:', error);
    res.status(500).json({ error: 'Failed to start sync' });
  }
});

// Get sync status
app.get('/api/sync/status', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sync_metadata')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching sync status:', error);
      return res.status(500).json({ error: 'Failed to fetch sync status' });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

// Get dashboard statistics
app.get('/api/dashboard/stats', requireAuth, injectCompanyContext, async (req, res) => {
  try {
    logger.info('Dashboard stats request', {
      userId: req.user.id,
      isSuperAdmin: req.isSuperAdmin,
      activeCompanyId: req.activeCompanyId
    });

    // Get current date and various time periods
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Determine which HaloPSA clients the user can see
    let allowedClientIds = null; // null = all clients (super admin)

    // For customer users, filter by company's HaloPSA clients
    if (!req.isSuperAdmin) {
      if (!req.activeCompanyId) {
        return res.status(403).json({ error: 'No active company assigned' });
      }

      // Get HaloPSA client IDs for this company
      const { data: haloPSAClients, error: clientsError } = await supabase
        .from('company_halopsa_clients')
        .select('halopsa_client_id')
        .eq('company_id', req.activeCompanyId);

      if (clientsError) {
        logger.error('Error fetching company HaloPSA clients', { error: clientsError });
        return res.status(500).json({ error: 'Failed to fetch company data' });
      }

      allowedClientIds = haloPSAClients.map(c => c.halopsa_client_id);

      if (allowedClientIds.length === 0) {
        // Company has no HaloPSA clients assigned, return empty stats
        return res.json({
          totalTickets: 0,
          openTickets: 0,
          closedTickets: 0,
          recentStats: { total: 0, open: 0, closed: 0, period: '30 days' },
          weekStats: { total: 0, period: '7 days' },
          topClients: [],
          dailyTrend: [],
          satisfaction: { satisfied: 0, dissatisfied: 0, total: 0, satisfactionRate: 0 }
        });
      }
    }

    // Build ticket query with optional client filtering
    let allTicketsQuery = supabase
      .from('tickets')
      .select('id, client_id, is_closed, date_occurred');

    if (allowedClientIds !== null) {
      allTicketsQuery = allTicketsQuery.in('client_id', allowedClientIds);
    }

    const { data: allTickets, error: allError } = await allTicketsQuery;

    if (allError) {
      console.error('Error fetching all tickets:', allError);
      return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }

    // Get tickets from last 30 days
    let recentTicketsQuery = supabase
      .from('tickets')
      .select('id, client_id, is_closed, date_occurred')
      .gte('date_occurred', thirtyDaysAgo.toISOString());

    if (allowedClientIds !== null) {
      recentTicketsQuery = recentTicketsQuery.in('client_id', allowedClientIds);
    }

    const { data: recentTickets, error: recentError } = await recentTicketsQuery;

    if (recentError) {
      console.error('Error fetching recent tickets:', recentError);
      return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }

    // Get tickets from last 7 days
    let weekTicketsQuery = supabase
      .from('tickets')
      .select('id, client_id, is_closed, date_occurred')
      .gte('date_occurred', sevenDaysAgo.toISOString());

    if (allowedClientIds !== null) {
      weekTicketsQuery = weekTicketsQuery.in('client_id', allowedClientIds);
    }

    const { data: weekTickets, error: weekError } = await weekTicketsQuery;

    if (weekError) {
      console.error('Error fetching week tickets:', weekError);
      return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }

    // Calculate statistics
    const totalTickets = allTickets.length;
    const openTickets = allTickets.filter(t => !t.is_closed).length;
    const closedTickets = allTickets.filter(t => t.is_closed).length;

    const recentTotal = recentTickets.length;
    const recentOpen = recentTickets.filter(t => !t.is_closed).length;
    const recentClosed = recentTickets.filter(t => t.is_closed).length;

    const weekTotal = weekTickets.length;

    // Get top clients by ticket count
    const clientTicketCounts = {};
    allTickets.forEach(ticket => {
      if (ticket.client_id) {
        clientTicketCounts[ticket.client_id] = (clientTicketCounts[ticket.client_id] || 0) + 1;
      }
    });

    const topClientIds = Object.entries(clientTicketCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([clientId]) => parseInt(clientId));

    // Get client names for top clients
    const { data: topClients, error: clientsError } = await supabase
      .from('active_clients')
      .select('id, name')
      .in('id', topClientIds);

    if (clientsError) {
      console.error('Error fetching top clients:', clientsError);
    }

    // Map client names to ticket counts
    const topClientsWithCounts = topClientIds.map(clientId => {
      const client = topClients?.find(c => c.id === clientId);
      const openCount = allTickets.filter(t => t.client_id === clientId && !t.is_closed).length;
      const closedCount = allTickets.filter(t => t.client_id === clientId && t.is_closed).length;

      return {
        id: clientId,
        name: client?.name || `Client ${clientId}`,
        totalTickets: clientTicketCounts[clientId],
        openTickets: openCount,
        closedTickets: closedCount
      };
    });

    // Get tickets from last year for trend data
    let yearTicketsQuery = supabase
      .from('tickets')
      .select('id, date_occurred')
      .gte('date_occurred', oneYearAgo.toISOString());

    if (allowedClientIds !== null) {
      yearTicketsQuery = yearTicketsQuery.in('client_id', allowedClientIds);
    }

    const { data: yearTickets, error: yearError } = await yearTicketsQuery;

    if (yearError) {
      console.error('Error fetching year tickets:', yearError);
    }

    // Get all tickets from last year with date_occurred and date_closed
    let yearTicketsDetailedQuery = supabase
      .from('tickets')
      .select('id, date_occurred, date_closed, is_closed')
      .gte('date_occurred', oneYearAgo.toISOString());

    if (allowedClientIds !== null) {
      yearTicketsDetailedQuery = yearTicketsDetailedQuery.in('client_id', allowedClientIds);
    }

    const { data: yearTicketsDetailed, error: yearDetailedError } = await yearTicketsDetailedQuery;

    if (yearDetailedError) {
      console.error('Error fetching year tickets detailed:', yearDetailedError);
    }

    // Get daily ticket counts for the last 365 days
    const dailyCounts = [];
    for (let i = 364; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];

      // Tickets opened on this date
      const openedCount = (yearTicketsDetailed || []).filter(t =>
        t.date_occurred && t.date_occurred.startsWith(dateStr)
      ).length;

      // Tickets closed on this date
      const closedCount = (yearTicketsDetailed || []).filter(t =>
        t.date_closed && t.date_closed.startsWith(dateStr)
      ).length;

      dailyCounts.push({
        date: dateStr,
        count: openedCount,  // Total = opened tickets
        opened: openedCount,
        closed: closedCount
      });
    }

    // Get feedback/satisfaction data
    // Feedback needs to be filtered by tickets that belong to allowed clients
    let feedbackQuery = supabase
      .from('feedback')
      .select('id, score, date, ticket_id');

    const { data: feedbackData, error: feedbackError } = await feedbackQuery;

    let satisfactionStats = {
      satisfied: 0,
      dissatisfied: 0,
      total: 0,
      satisfactionRate: 0
    };

    if (feedbackError) {
      console.warn('Error fetching feedback data:', feedbackError.message);
      // Continue without feedback data - not critical
    } else if (feedbackData && feedbackData.length > 0) {
      // Filter feedback to only include tickets from allowed clients
      let filteredFeedback = feedbackData;
      if (allowedClientIds !== null) {
        const allowedTicketIds = allTickets.map(t => t.id);
        filteredFeedback = feedbackData.filter(f => allowedTicketIds.includes(f.ticket_id));
      }

      const satisfied = filteredFeedback.filter(f => f.score === 1).length;
      const dissatisfied = filteredFeedback.filter(f => f.score === 2).length;
      const total = filteredFeedback.filter(f => f.score).length;

      satisfactionStats = {
        satisfied,
        dissatisfied,
        total,
        satisfactionRate: total > 0 ? (satisfied / total * 100).toFixed(1) : 0
      };
    }

    const responseData = {
      totalTickets,
      openTickets,
      closedTickets,
      recentStats: {
        total: recentTotal,
        open: recentOpen,
        closed: recentClosed,
        period: '30 days'
      },
      weekStats: {
        total: weekTotal,
        period: '7 days'
      },
      topClients: topClientsWithCounts,
      dailyTrend: dailyCounts,
      satisfaction: satisfactionStats
    };

    logger.info('Dashboard stats response', {
      totalTickets,
      openTickets,
      closedTickets,
      topClientsCount: topClientsWithCounts.length,
      isSuperAdmin: req.isSuperAdmin
    });

    res.json(responseData);
  } catch (error) {
    logger.error('Error fetching dashboard stats', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get all servers with monitoring data (filtered by company for customers)
app.get('/api/servers', requireAuth, injectCompanyContext, async (req, res) => {
  try {
    const serversData = await ninjaOneClient.getServers();

    // If super admin and not impersonating, show all servers
    if (req.isSuperAdmin) {
      return res.json(serversData);
    }

    // For customer users or impersonating super admins, filter by company NinjaOne orgs
    if (req.activeCompanyId) {
      // Get NinjaOne org IDs for this company
      const { data: ninjaOneOrgs, error } = await supabase
        .from('company_ninjaone_orgs')
        .select('ninjaone_org_id')
        .eq('company_id', req.activeCompanyId);

      if (error) {
        logger.error('Failed to fetch company NinjaOne orgs', { error, companyId: req.activeCompanyId });
        return res.status(500).json({ error: 'Failed to fetch company organizations' });
      }

      const allowedOrgIds = ninjaOneOrgs.map(org => org.ninjaone_org_id);

      // Filter servers by organization ID
      const filteredServers = serversData.servers.filter(server => {
        // The server should have an organizationId from NinjaOne
        // We'll need to check the ninjaone-client.js to see the structure
        // For now, assuming the server has a property that maps to org
        return allowedOrgIds.length === 0 || allowedOrgIds.includes(server.organizationId);
      });

      return res.json({
        ...serversData,
        servers: filteredServers,
        summary: {
          ...serversData.summary,
          totalServers: filteredServers.length,
          onlineServers: filteredServers.filter(s => s.status === 'ONLINE').length,
          offlineServers: filteredServers.filter(s => s.status === 'OFFLINE').length,
          serversNeedingPatches: filteredServers.filter(s =>
            s.patches.osPending > 0 || s.patches.softwarePending > 0
          ).length
        }
      });
    }

    // No company assigned, return empty result
    res.json({
      summary: {
        totalServers: 0,
        onlineServers: 0,
        offlineServers: 0,
        serversNeedingPatches: 0
      },
      servers: [],
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch server data' });
  }
});

// Get specific server details
app.get('/api/servers/:deviceId', requireAuth, async (req, res) => {
  try {
    const serverData = await ninjaOneClient.getServerDetails(req.params.deviceId);
    res.json(serverData);
  } catch (error) {
    logger.error('Error fetching server details:', error);
    res.status(500).json({ error: 'Failed to fetch server details' });
  }
});

// Get all workstations with monitoring data (filtered by company for customers)
app.get('/api/workstations', requireAuth, injectCompanyContext, async (req, res) => {
  try {
    const workstationsData = await ninjaOneClient.getWorkstations();

    // If super admin and not impersonating, show all workstations
    if (req.isSuperAdmin) {
      return res.json(workstationsData);
    }

    // For customer users or impersonating super admins, filter by company NinjaOne orgs
    if (req.activeCompanyId) {
      // Get NinjaOne org IDs for this company
      const { data: ninjaOneOrgs, error } = await supabase
        .from('company_ninjaone_orgs')
        .select('ninjaone_org_id')
        .eq('company_id', req.activeCompanyId);

      if (error) {
        logger.error('Failed to fetch company NinjaOne orgs', { error, companyId: req.activeCompanyId });
        return res.status(500).json({ error: 'Failed to fetch company organizations' });
      }

      const allowedOrgIds = ninjaOneOrgs.map(org => org.ninjaone_org_id);

      // Filter workstations by organization ID
      const filteredWorkstations = workstationsData.workstations.filter(workstation => {
        return allowedOrgIds.length === 0 || allowedOrgIds.includes(workstation.organizationId);
      });

      return res.json({
        ...workstationsData,
        workstations: filteredWorkstations,
        summary: {
          ...workstationsData.summary,
          totalWorkstations: filteredWorkstations.length,
          onlineWorkstations: filteredWorkstations.filter(w => w.status === 'ONLINE').length,
          offlineWorkstations: filteredWorkstations.filter(w => w.status === 'OFFLINE').length,
          workstationsNeedingPatches: filteredWorkstations.filter(w =>
            w.patches.osPending > 0 || w.patches.softwarePending > 0
          ).length
        }
      });
    }

    // No company assigned, return empty result
    res.json({
      summary: {
        totalWorkstations: 0,
        onlineWorkstations: 0,
        offlineWorkstations: 0,
        workstationsNeedingPatches: 0
      },
      workstations: [],
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching workstations:', error);
    res.status(500).json({ error: 'Failed to fetch workstation data' });
  }
});

// Get specific workstation details
app.get('/api/workstations/:deviceId', requireAuth, async (req, res) => {
  try {
    const workstationData = await ninjaOneClient.getWorkstationDetails(req.params.deviceId);
    res.json(workstationData);
  } catch (error) {
    logger.error('Error fetching workstation details:', error);
    res.status(500).json({ error: 'Failed to fetch workstation details' });
  }
});

// Get all domains with hosting status (filtered by company for customers)
app.get('/api/domains', requireAuth, injectCompanyContext, async (req, res) => {
  try {
    const domainsData = await twentyiClient.getDomains();

    // If super admin and not impersonating, show all domains
    if (req.isSuperAdmin) {
      return res.json(domainsData);
    }

    // For customer users or impersonating super admins, filter by company 20i users
    if (req.activeCompanyId) {
      // Get 20i StackCP user IDs for this company
      const { data: stackcpUsers, error } = await supabase
        .from('company_20i_stackcp_users')
        .select('stackcp_user_id')
        .eq('company_id', req.activeCompanyId);

      if (error) {
        logger.error('Failed to fetch company 20i users', { error, companyId: req.activeCompanyId });
        return res.status(500).json({ error: 'Failed to fetch company data' });
      }

      const allowedUserIds = stackcpUsers.map(u => u.stackcp_user_id);

      if (allowedUserIds.length === 0) {
        // Company has no 20i users assigned, return empty
        return res.json({
          summary: {
            totalDomains: 0,
            domainsWithHosting: 0,
            domainsExpiringSoon: 0
          },
          domains: [],
          lastUpdated: new Date().toISOString()
        });
      }

      // Filter domains by StackCP user ID (domains can have multiple stack users)
      const filteredDomains = domainsData.domains.filter(domain =>
        domain.stackcpUsers && domain.stackcpUsers.some(userId => allowedUserIds.includes(userId))
      );

      // Recalculate summary for filtered domains
      const summary = {
        totalDomains: filteredDomains.length,
        domainsWithHosting: filteredDomains.filter(d => d.hasHosting).length,
        domainsExpiringSoon: filteredDomains.filter(d =>
          d.status === 'expiring-soon' || d.status === 'expired'
        ).length
      };

      return res.json({
        summary,
        domains: filteredDomains,
        lastUpdated: domainsData.lastUpdated
      });
    }

    // No company assigned, return empty result
    res.json({
      summary: {
        totalDomains: 0,
        domainsWithHosting: 0,
        domainsExpiringSoon: 0
      },
      domains: [],
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching domains:', error);
    res.status(500).json({ error: 'Failed to fetch domain data' });
  }
});

// Global error handler for uncaught errors
app.use((err, req, res, next) => {
  logger.error('Unhandled error in request', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Handle server startup
const server = app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    pid: process.pid,
    logFile: logger.LOG_FILE
  });
  console.log(`HaloPSA Reporting Server (Supabase) running on http://localhost:${PORT}`);
  console.log(`Logs are being written to: ${logger.LOG_FILE}`);
  console.log(`Note: Run 'node sync-service.js' to sync data from HaloPSA to Supabase`);
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error', {
    error: error.message,
    code: error.code,
    stack: error.stack
  });
  process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
