CREATE TABLE IF NOT EXISTS arena_sessions (
  id uuid PRIMARY KEY,
  srv jsonb NOT NULL,
  log_cursor integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  winner text
);
