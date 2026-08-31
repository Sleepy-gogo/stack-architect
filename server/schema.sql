CREATE TABLE IF NOT EXISTS shared_projects (
  id TEXT PRIMARY KEY CHECK (length(id) = 12),
  document TEXT NOT NULL,
  edit_token_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS share_rate_limits (
  fingerprint TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
