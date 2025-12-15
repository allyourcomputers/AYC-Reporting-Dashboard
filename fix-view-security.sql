-- Fix SECURITY DEFINER Warning for active_clients View
-- Run this in your Supabase SQL Editor

-- Drop the existing view
DROP VIEW IF EXISTS active_clients;

-- Recreate the view with SECURITY INVOKER (safer - uses querying user's permissions)
CREATE OR REPLACE VIEW active_clients
WITH (security_invoker = true)
AS
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

-- Verify the view was created with SECURITY INVOKER
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'active_clients';
