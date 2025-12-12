-- Add feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id),
  score INTEGER NOT NULL,
  score_band INTEGER,
  date TIMESTAMP NOT NULL,
  comment TEXT,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feedback_ticket_id ON feedback(ticket_id);
CREATE INDEX IF NOT EXISTS idx_feedback_date ON feedback(date);
CREATE INDEX IF NOT EXISTS idx_feedback_score ON feedback(score);
