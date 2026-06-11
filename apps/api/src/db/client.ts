import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type {
  AgentStatus,
  CloseTradeInput,
  CreateDecisionInput,
  CreateTradeInput,
  Decision,
  HeartbeatInput,
  Metrics,
  PaginatedResponse,
  Trade,
} from "../types/index.js";
import { SCHEMA } from "./schema.js";

interface DecisionRow {
  id: number;
  timestamp: string;
  asset: string;
  action: string;
  confidence: number;
  reasoning: string;
  price: number;
  created_at: string;
}

interface TradeRow {
  id: number;
  timestamp: string;
  asset: string;
  direction: string;
  entry_price: number;
  exit_price: number | null;
  size: number;
  pnl: number | null;
  status: string;
  confidence: number;
  tx_hash: string | null;
  closed_at: string | null;
  created_at: string;
}

interface AgentStatusRow {
  status: string;
  last_heartbeat: string | null;
  uptime_seconds: number;
  current_balance: number;
  starting_balance: number;
  updated_at: string;
}

function mapDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    timestamp: row.timestamp,
    asset: row.asset,
    action: row.action as Decision["action"],
    confidence: row.confidence,
    reasoning: row.reasoning,
    price: row.price,
    createdAt: row.created_at,
  };
}

function mapTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    timestamp: row.timestamp,
    asset: row.asset,
    direction: row.direction as Trade["direction"],
    entryPrice: row.entry_price,
    exitPrice: row.exit_price,
    size: row.size,
    pnl: row.pnl,
    status: row.status as Trade["status"],
    confidence: row.confidence,
    txHash: row.tx_hash,
    closedAt: row.closed_at,
    createdAt: row.created_at,
  };
}

function mapAgentStatus(row: AgentStatusRow): AgentStatus {
  return {
    status: row.status as AgentStatus["status"],
    lastHeartbeat: row.last_heartbeat,
    uptimeSeconds: row.uptime_seconds,
    currentBalance: row.current_balance,
    startingBalance: row.starting_balance,
    updatedAt: row.updated_at,
  };
}

/** Returns an ISO 8601 timestamp `hoursAgo` hours before now (used to backdate seed data). */
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

/** SQLite-backed persistence for the MantleEdge API server. */
export class ApiDatabase {
  private readonly db: Database.Database;

  constructor(filePath: string) {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.db = new Database(filePath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
    this.seedAgentStatus();
    this.seedDemoData();
    this.cleanupFakeTxHashes();
  }

  /** Ensures the single `agent_status` row exists, defaulting to an idle agent with $10,000 starting balance. */
  private seedAgentStatus(): void {
    const existing = this.db.prepare("SELECT id FROM agent_status WHERE id = 1").get();
    if (existing) return;
    this.db
      .prepare(
        `INSERT INTO agent_status (id, status, last_heartbeat, uptime_seconds, current_balance, starting_balance, updated_at)
         VALUES (1, 'IDLE', NULL, 0, 10000, 10000, ?)`,
      )
      .run(new Date().toISOString());
  }

  /** Seeds 5 sample decisions and 3 sample trades on first run, so the dashboard is never empty during a demo. */
  private seedDemoData(): void {
    const decisionCount = (this.db.prepare("SELECT COUNT(*) AS c FROM decisions").get() as { c: number }).c;
    const tradeCount = (this.db.prepare("SELECT COUNT(*) AS c FROM trades").get() as { c: number }).c;
    if (decisionCount > 0 || tradeCount > 0) return;

    const seed = this.db.transaction(() => {
      const insertDecision = this.db.prepare(
        `INSERT INTO decisions (timestamp, asset, action, confidence, reasoning, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      insertDecision.run(hoursAgo(5), "MNT/USDT", "LONG", 78, "EMA20 crossed above EMA50 with rising volume; momentum favors an upside continuation.", 0.7421);
      insertDecision.run(hoursAgo(4), "MNT/USDT", "WAIT", 52, "RSI approaching overbought territory; waiting for a pullback before adding exposure.", 0.7689);
      insertDecision.run(hoursAgo(3), "MNT/USDT", "SHORT", 65, "Price rejected at resistance with bearish divergence on the 1h chart.", 0.7583);
      insertDecision.run(hoursAgo(2), "MNT/USDT", "LONG", 81, "Support held at the 20-period EMA with a bullish engulfing candle on increasing volume.", 0.7312);
      insertDecision.run(hoursAgo(1), "MNT/USDT", "WAIT", 45, "Mixed signals across timeframes; confidence too low to justify a new position.", 0.7455);

      const insertTrade = this.db.prepare(
        `INSERT INTO trades (timestamp, asset, direction, entry_price, exit_price, size, pnl, status, confidence, tx_hash, closed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      // Closed winning trade.
      insertTrade.run(hoursAgo(5), "MNT/USDT", "LONG", 0.7421, 0.7589, 500, 11.32, "CLOSED", 78, null, hoursAgo(3.5));
      // Closed losing trade.
      insertTrade.run(hoursAgo(3), "MNT/USDT", "SHORT", 0.7583, 0.7641, 400, -3.06, "CLOSED", 65, null, hoursAgo(2));
      // Currently open trade.
      insertTrade.run(hoursAgo(2), "MNT/USDT", "LONG", 0.7312, null, 600, null, "OPEN", 81, null, null);
    });
    seed();
  }

  /**
   * One-time cleanup for databases seeded before this fix: clears the
   * placeholder `0xseed...` tx hashes so the trade history page shows
   * "PAPER TRADE" instead of a link to a non-existent on-chain transaction.
   */
  private cleanupFakeTxHashes(): void {
    this.db.prepare("UPDATE trades SET tx_hash = NULL WHERE tx_hash LIKE '0xseed%'").run();
  }

  // ---------------------------------------------------------------------
  // Decisions
  // ---------------------------------------------------------------------

  listDecisions(limit: number, offset: number): PaginatedResponse<Decision> {
    const rows = this.db
      .prepare("SELECT * FROM decisions ORDER BY id DESC LIMIT ? OFFSET ?")
      .all(limit, offset) as DecisionRow[];
    const total = (this.db.prepare("SELECT COUNT(*) AS c FROM decisions").get() as { c: number }).c;
    return { data: rows.map(mapDecision), total, hasMore: offset + rows.length < total };
  }

  createDecision(input: CreateDecisionInput): Decision {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO decisions (timestamp, asset, action, confidence, reasoning, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(timestamp, input.asset, input.action, input.confidence, input.reasoning, input.price);
    return mapDecision(this.db.prepare("SELECT * FROM decisions WHERE id = ?").get(result.lastInsertRowid) as DecisionRow);
  }

  getRecentDecisions(limit: number): Decision[] {
    const rows = this.db.prepare("SELECT * FROM decisions ORDER BY id DESC LIMIT ?").all(limit) as DecisionRow[];
    return rows.map(mapDecision);
  }

  // ---------------------------------------------------------------------
  // Trades
  // ---------------------------------------------------------------------

  listTrades(limit: number, offset: number, status?: "OPEN" | "CLOSED"): PaginatedResponse<Trade> {
    const where = status ? "WHERE status = ?" : "";
    const params = status ? [status] : [];

    const rows = this.db
      .prepare(`SELECT * FROM trades ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as TradeRow[];
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM trades ${where}`).get(...params) as { c: number }
    ).c;
    return { data: rows.map(mapTrade), total, hasMore: offset + rows.length < total };
  }

  getTradeById(id: number): Trade | null {
    const row = this.db.prepare("SELECT * FROM trades WHERE id = ?").get(id) as TradeRow | undefined;
    return row ? mapTrade(row) : null;
  }

  createTrade(input: CreateTradeInput): Trade {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO trades (timestamp, asset, direction, entry_price, size, status, confidence, tx_hash)
         VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
      )
      .run(timestamp, input.asset, input.direction, input.entryPrice, input.size, input.confidence ?? 0, input.txHash ?? null);
    return mapTrade(this.db.prepare("SELECT * FROM trades WHERE id = ?").get(result.lastInsertRowid) as TradeRow);
  }

  /**
   * Closes an open trade at `exitPrice`, computing realized PnL based on the
   * trade's direction. Returns `null` if no trade with that id exists, and
   * `"already-closed"` if the trade has already been closed.
   */
  closeTrade(id: number, input: CloseTradeInput): Trade | null | "already-closed" {
    const row = this.db.prepare("SELECT * FROM trades WHERE id = ?").get(id) as TradeRow | undefined;
    if (!row) return null;
    if (row.status === "CLOSED") return "already-closed";

    const directionMultiplier = row.direction === "LONG" ? 1 : -1;
    const pnl = row.size * directionMultiplier * ((input.exitPrice - row.entry_price) / row.entry_price);
    const closedAt = input.closedAt ?? new Date().toISOString();

    this.db
      .prepare("UPDATE trades SET exit_price = ?, pnl = ?, status = 'CLOSED', closed_at = ? WHERE id = ?")
      .run(input.exitPrice, pnl, closedAt, id);

    return mapTrade(this.db.prepare("SELECT * FROM trades WHERE id = ?").get(id) as TradeRow);
  }

  getRecentTrades(limit: number): Trade[] {
    const rows = this.db.prepare("SELECT * FROM trades ORDER BY id DESC LIMIT ?").all(limit) as TradeRow[];
    return rows.map(mapTrade);
  }

  // ---------------------------------------------------------------------
  // Agent status
  // ---------------------------------------------------------------------

  getAgentStatus(): AgentStatus {
    return mapAgentStatus(this.db.prepare("SELECT * FROM agent_status WHERE id = 1").get() as AgentStatusRow);
  }

  recordHeartbeat(input: HeartbeatInput): AgentStatus {
    const current = this.getAgentStatus();
    const status = input.status ?? "RUNNING";
    const currentBalance = input.currentBalance ?? current.currentBalance;
    const uptimeSeconds = input.uptimeSeconds ?? current.uptimeSeconds;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE agent_status
         SET status = ?, last_heartbeat = ?, uptime_seconds = ?, current_balance = ?, updated_at = ?
         WHERE id = 1`,
      )
      .run(status, now, uptimeSeconds, currentBalance, now);

    return this.getAgentStatus();
  }

  // ---------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------

  getMetrics(): Metrics {
    const totalDecisions = (this.db.prepare("SELECT COUNT(*) AS c FROM decisions").get() as { c: number }).c;
    const totalTrades = (this.db.prepare("SELECT COUNT(*) AS c FROM trades").get() as { c: number }).c;
    const openTrades = (
      this.db.prepare("SELECT COUNT(*) AS c FROM trades WHERE status = 'OPEN'").get() as { c: number }
    ).c;
    const closedTrades = totalTrades - openTrades;
    const winCount = (
      this.db.prepare("SELECT COUNT(*) AS c FROM trades WHERE status = 'CLOSED' AND pnl > 0").get() as { c: number }
    ).c;
    const lossCount = (
      this.db.prepare("SELECT COUNT(*) AS c FROM trades WHERE status = 'CLOSED' AND pnl <= 0").get() as {
        c: number;
      }
    ).c;
    const totalPnl = (
      this.db.prepare("SELECT COALESCE(SUM(pnl), 0) AS s FROM trades WHERE status = 'CLOSED'").get() as { s: number }
    ).s;
    const avgConfidenceRow = this.db.prepare("SELECT AVG(confidence) AS a FROM decisions").get() as {
      a: number | null;
    };

    const { currentBalance, startingBalance } = this.getAgentStatus();
    const winRate = closedTrades > 0 ? (winCount / closedTrades) * 100 : 0;
    const totalPnlPct = startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0;

    return {
      totalDecisions,
      totalTrades,
      openTrades,
      closedTrades,
      winCount,
      lossCount,
      winRate,
      totalPnl,
      totalPnlPct,
      avgConfidence: avgConfidenceRow.a ?? 0,
      currentBalance,
      startingBalance,
    };
  }

  close(): void {
    this.db.close();
  }
}

export const db = new ApiDatabase(config.dbPath);
