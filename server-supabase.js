require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { performFullSync } = require('./sync-service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_KEY
  });
});

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve all static files (authentication is handled client-side)
// API routes are protected with the requireAuth middleware
app.use(express.static('public'));

// Get all active clients (clients with tickets in the last 12 months)
app.get('/api/clients', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('active_clients')
      .select('*')
      .order('name', { ascending: true });

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
app.get('/api/tickets/stats', requireAuth, async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;

    if (!clientId || !startDate || !endDate) {
      return res.status(400).json({ error: 'clientId, startDate, and endDate are required' });
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
app.post('/api/tickets/monthly-stats', requireAuth, async (req, res) => {
  try {
    const { clientId, months } = req.body;

    if (!clientId || !months || !Array.isArray(months)) {
      return res.status(400).json({ error: 'clientId and months array are required' });
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
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    // Get current date and various time periods
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Get all tickets
    const { data: allTickets, error: allError } = await supabase
      .from('tickets')
      .select('id, client_id, is_closed, date_occurred');

    if (allError) {
      console.error('Error fetching all tickets:', allError);
      return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }

    // Get tickets from last 30 days
    const { data: recentTickets, error: recentError } = await supabase
      .from('tickets')
      .select('id, client_id, is_closed, date_occurred')
      .gte('date_occurred', thirtyDaysAgo.toISOString());

    if (recentError) {
      console.error('Error fetching recent tickets:', recentError);
      return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }

    // Get tickets from last 7 days
    const { data: weekTickets, error: weekError } = await supabase
      .from('tickets')
      .select('id, client_id, is_closed, date_occurred')
      .gte('date_occurred', sevenDaysAgo.toISOString());

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
    const { data: yearTickets, error: yearError } = await supabase
      .from('tickets')
      .select('id, date_occurred')
      .gte('date_occurred', oneYearAgo.toISOString());

    if (yearError) {
      console.error('Error fetching year tickets:', yearError);
    }

    // Get all tickets from last year with date_occurred and date_closed
    const { data: yearTicketsDetailed, error: yearDetailedError } = await supabase
      .from('tickets')
      .select('id, date_occurred, date_closed, is_closed')
      .gte('date_occurred', oneYearAgo.toISOString());

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
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('feedback')
      .select('id, score, date');

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
      const satisfied = feedbackData.filter(f => f.score === 1).length;
      const dissatisfied = feedbackData.filter(f => f.score === 2).length;
      const total = feedbackData.filter(f => f.score).length;

      satisfactionStats = {
        satisfied,
        dissatisfied,
        total,
        satisfactionRate: total > 0 ? (satisfied / total * 100).toFixed(1) : 0
      };
    }

    res.json({
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
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

app.listen(PORT, () => {
  console.log(`HaloPSA Reporting Server (Supabase) running on http://localhost:${PORT}`);
  console.log(`Note: Run 'node sync-service.js' to sync data from HaloPSA to Supabase`);
});
