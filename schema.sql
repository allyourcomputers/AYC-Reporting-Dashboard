-- HaloPSA Reporting Database Schema

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  toplevel_id INTEGER,
  toplevel_name TEXT,
  inactive BOOLEAN DEFAULT false,
  colour TEXT,
  last_ticket_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  client_name TEXT,
  site_id INTEGER,
  site_name TEXT,
  user_id INTEGER,
  user_name TEXT,
  summary TEXT,
  details TEXT,
  status_id INTEGER,
  status_name TEXT,
  priority_id INTEGER,
  tickettype_id INTEGER,
  team_id INTEGER,
  team TEXT,
  agent_id INTEGER,
  date_occurred TIMESTAMP NOT NULL,
  date_closed TIMESTAMP,
  response_date TIMESTAMP,
  last_action_date TIMESTAMP,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_date_occurred ON tickets(date_occurred);
CREATE INDEX IF NOT EXISTS idx_tickets_is_closed ON tickets(is_closed);
CREATE INDEX IF NOT EXISTS idx_clients_last_ticket_date ON clients(last_ticket_date);
CREATE INDEX IF NOT EXISTS idx_tickets_client_date ON tickets(client_id, date_occurred);

-- Create a view for active clients (tickets in last 12 months)
CREATE OR REPLACE VIEW active_clients AS
SELECT DISTINCT
  c.id,
  c.name,
  c.toplevel_id,
  c.toplevel_name,
  c.inactive,
  c.colour,
  c.last_ticket_date,
  COUNT(t.id) as ticket_count_last_12_months
FROM clients c
INNER JOIN tickets t ON c.id = t.client_id
WHERE t.date_occurred >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY c.id, c.name, c.toplevel_id, c.toplevel_name, c.inactive, c.colour, c.last_ticket_date
ORDER BY c.name;

-- Sync metadata table to track last sync times
CREATE TABLE IF NOT EXISTS sync_metadata (
  id SERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL,
  last_sync TIMESTAMP NOT NULL,
  records_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
