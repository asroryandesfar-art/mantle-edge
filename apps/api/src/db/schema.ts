/**
 * SQLite schema for the MantleEdge API server.
 *
 * - `decisions`: every directional call the agent's MarketAnalystAgent makes,
 *   regardless of whether it was acted on.
 * - `trades`: paper/on-chain positions opened (and later closed) as a result
 *   of approved decisions.
 * - `agent_status`: a single-row table tracking the agent's current
 *   operational state, updated via heartbeats.
 *
 * All timestamps are stored as ISO 8601 strings (UTC).
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  asset TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('LONG', 'SHORT', 'WAIT')),
  confidence REAL NOT NULL,
  reasoning TEXT NOT NULL,
  price REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  asset TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  entry_price REAL NOT NULL,
  exit_price REAL,
  size REAL NOT NULL,
  pnl REAL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  confidence REAL NOT NULL DEFAULT 0,
  tx_hash TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS agent_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'IDLE' CHECK (status IN ('RUNNING', 'IDLE', 'STOPPED', 'ERROR')),
  last_heartbeat TEXT,
  uptime_seconds INTEGER NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 10000,
  starting_balance REAL NOT NULL DEFAULT 10000,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades (status);
`;
