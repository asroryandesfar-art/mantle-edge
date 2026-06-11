import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { ExecutionResult, MarketSignal, OpenPosition, PortfolioState, TradeDecision } from "./types.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS portfolio (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cash REAL NOT NULL,
  realized_pnl REAL NOT NULL,
  day_start_equity REAL NOT NULL,
  day_start_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  asset TEXT PRIMARY KEY,
  direction TEXT NOT NULL,
  entry_price REAL NOT NULL,
  size REAL NOT NULL,
  stop_loss REAL NOT NULL,
  opened_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  asset TEXT NOT NULL,
  direction TEXT NOT NULL,
  confidence REAL NOT NULL,
  price REAL NOT NULL,
  reasoning TEXT NOT NULL,
  approved INTEGER NOT NULL,
  action TEXT NOT NULL,
  size REAL NOT NULL,
  stop_loss REAL NOT NULL,
  reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  asset TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  price REAL NOT NULL,
  size REAL NOT NULL,
  pnl REAL,
  entry_price REAL,
  confidence REAL NOT NULL DEFAULT 0,
  tx_hash TEXT,
  log_tx_hash TEXT,
  error TEXT
);
`;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface DecisionRecord {
  timestamp: number;
  asset: string;
  direction: string;
  confidence: number;
  price: number;
  reasoning: string;
  approved: boolean;
  action: string;
  size: number;
  stopLoss: number;
  reason: string;
}

export interface TradeRecord {
  timestamp: number;
  asset: string;
  action: string;
  status: string;
  price: number;
  size: number;
  pnl: number | null;
  entryPrice: number | null;
  confidence: number;
  txHash: string | null;
  logTxHash: string | null;
  error: string | null;
}

export interface TradingStats {
  decisionCount: number;
  tradeCount: number;
  /** Total trade records, regardless of status (includes paper-only and failed on-chain executions). */
  totalTrades: number;
  winCount: number;
  lossCount: number;
  failedExecutions: number;
}

/** SQLite-backed persistence for the multi-agent paper-trading system. */
export class TradingDb {
  private readonly db: Database.Database;

  constructor(filePath: string, startingEquityUsd: number) {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.db = new Database(filePath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
    this.migrate();
    this.seedPortfolio(startingEquityUsd);
  }

  /** Adds columns introduced after the initial schema to pre-existing databases, then backfills them. */
  private migrate(): void {
    const columns = (this.db.prepare("PRAGMA table_info(trades)").all() as Array<{ name: string }>).map(
      (c) => c.name,
    );
    if (!columns.includes("entry_price")) {
      this.db.exec("ALTER TABLE trades ADD COLUMN entry_price REAL");
    }
    if (!columns.includes("confidence")) {
      this.db.exec("ALTER TABLE trades ADD COLUMN confidence REAL NOT NULL DEFAULT 0");
    }

    // Backfill entry_price for pre-existing CLOSE trades from the position they closed.
    this.db.exec(`
      UPDATE trades SET entry_price = (
        SELECT price FROM trades AS open_trade
        WHERE open_trade.asset = trades.asset
          AND open_trade.action IN ('OPEN_LONG', 'OPEN_SHORT')
          AND open_trade.timestamp < trades.timestamp
        ORDER BY open_trade.timestamp DESC LIMIT 1
      )
      WHERE trades.action = 'CLOSE' AND trades.entry_price IS NULL
    `);
  }

  private seedPortfolio(startingEquityUsd: number): void {
    const existing = this.db.prepare("SELECT id FROM portfolio WHERE id = 1").get();
    if (existing) return;
    this.db
      .prepare(
        "INSERT INTO portfolio (id, cash, realized_pnl, day_start_equity, day_start_date) VALUES (1, ?, 0, ?, ?)",
      )
      .run(startingEquityUsd, startingEquityUsd, todayUtc());
  }

  /** Returns the current portfolio state, rolling over the daily-loss baseline if a new UTC day has started. */
  getPortfolioState(): PortfolioState {
    const row = this.db
      .prepare("SELECT cash, realized_pnl, day_start_equity, day_start_date FROM portfolio WHERE id = 1")
      .get() as { cash: number; realized_pnl: number; day_start_equity: number; day_start_date: string };

    const positions = this.getOpenPositions();
    const equity = row.cash + positions.reduce((sum, p) => sum + p.size, 0);

    const today = todayUtc();
    let dayStartEquity = row.day_start_equity;
    if (row.day_start_date !== today) {
      this.db
        .prepare("UPDATE portfolio SET day_start_equity = ?, day_start_date = ? WHERE id = 1")
        .run(equity, today);
      dayStartEquity = equity;
    }

    return {
      equity,
      cash: row.cash,
      dayStartEquity,
      realizedPnl: row.realized_pnl,
      positions,
    };
  }

  getOpenPositions(): OpenPosition[] {
    const rows = this.db
      .prepare("SELECT asset, direction, entry_price, size, stop_loss, opened_at FROM positions")
      .all() as Array<{
      asset: string;
      direction: "LONG" | "SHORT";
      entry_price: number;
      size: number;
      stop_loss: number;
      opened_at: number;
    }>;
    return rows.map((r) => ({
      asset: r.asset,
      direction: r.direction,
      entryPrice: r.entry_price,
      size: r.size,
      stopLoss: r.stop_loss,
      openedAt: r.opened_at,
    }));
  }

  getOpenPosition(asset: string): OpenPosition | null {
    const r = this.db
      .prepare("SELECT asset, direction, entry_price, size, stop_loss, opened_at FROM positions WHERE asset = ?")
      .get(asset) as
      | { asset: string; direction: "LONG" | "SHORT"; entry_price: number; size: number; stop_loss: number; opened_at: number }
      | undefined;
    if (!r) return null;
    return {
      asset: r.asset,
      direction: r.direction,
      entryPrice: r.entry_price,
      size: r.size,
      stopLoss: r.stop_loss,
      openedAt: r.opened_at,
    };
  }

  /** Opens a new paper position, deducting its notional size from free cash. */
  openPosition(position: OpenPosition): void {
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          "INSERT OR REPLACE INTO positions (asset, direction, entry_price, size, stop_loss, opened_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(position.asset, position.direction, position.entryPrice, position.size, position.stopLoss, position.openedAt);
      this.db.prepare("UPDATE portfolio SET cash = cash - ? WHERE id = 1").run(position.size);
    });
    tx();
  }

  /** Closes an open position at `exitPrice`, returning its realized PnL in USD and original entry price. */
  closePosition(asset: string, exitPrice: number): { pnl: number; entryPrice: number } {
    const position = this.getOpenPosition(asset);
    if (!position) return { pnl: 0, entryPrice: exitPrice };

    const direction = position.direction === "LONG" ? 1 : -1;
    const pnl = position.size * direction * ((exitPrice - position.entryPrice) / position.entryPrice);

    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM positions WHERE asset = ?").run(asset);
      this.db
        .prepare("UPDATE portfolio SET cash = cash + ?, realized_pnl = realized_pnl + ? WHERE id = 1")
        .run(position.size + pnl, pnl);
    });
    tx();

    return { pnl, entryPrice: position.entryPrice };
  }

  recordDecision(signal: MarketSignal, decision: TradeDecision): void {
    this.db
      .prepare(
        `INSERT INTO decisions (timestamp, asset, direction, confidence, price, reasoning, approved, action, size, stop_loss, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        signal.timestamp,
        signal.asset,
        signal.direction,
        signal.confidence,
        signal.price,
        signal.reasoning,
        decision.approved ? 1 : 0,
        decision.action,
        decision.size,
        decision.stopLoss,
        decision.reason,
      );
  }

  recordTrade(result: ExecutionResult): void {
    this.db
      .prepare(
        `INSERT INTO trades (timestamp, asset, action, status, price, size, pnl, entry_price, confidence, tx_hash, log_tx_hash, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        result.timestamp,
        result.asset,
        result.action,
        result.status,
        result.price,
        result.size,
        result.pnl ?? null,
        result.entryPrice ?? null,
        result.confidence ?? 0,
        result.txHash ?? null,
        result.logTxHash ?? null,
        result.error ?? null,
      );
  }

  getRecentDecisions(limit: number): DecisionRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM decisions ORDER BY id DESC LIMIT ?")
      .all(limit) as Array<{
      timestamp: number;
      asset: string;
      direction: string;
      confidence: number;
      price: number;
      reasoning: string;
      approved: number;
      action: string;
      size: number;
      stop_loss: number;
      reason: string;
    }>;
    return rows.map((r) => ({
      timestamp: r.timestamp,
      asset: r.asset,
      direction: r.direction,
      confidence: r.confidence,
      price: r.price,
      reasoning: r.reasoning,
      approved: r.approved === 1,
      action: r.action,
      size: r.size,
      stopLoss: r.stop_loss,
      reason: r.reason,
    }));
  }

  getRecentTrades(limit: number): TradeRecord[] {
    const rows = this.db.prepare("SELECT * FROM trades ORDER BY id DESC LIMIT ?").all(limit) as Array<{
      timestamp: number;
      asset: string;
      action: string;
      status: string;
      price: number;
      size: number;
      pnl: number | null;
      entry_price: number | null;
      confidence: number;
      tx_hash: string | null;
      log_tx_hash: string | null;
      error: string | null;
    }>;
    return rows.map((r) => ({
      timestamp: r.timestamp,
      asset: r.asset,
      action: r.action,
      status: r.status,
      price: r.price,
      size: r.size,
      pnl: r.pnl,
      entryPrice: r.entry_price,
      confidence: r.confidence,
      txHash: r.tx_hash,
      logTxHash: r.log_tx_hash,
      error: r.error,
    }));
  }

  getStats(): TradingStats {
    const decisionCount = (this.db.prepare("SELECT COUNT(*) AS c FROM decisions").get() as { c: number }).c;
    const totalTrades = (this.db.prepare("SELECT COUNT(*) AS c FROM trades").get() as { c: number }).c;
    const tradeCount = (
      this.db.prepare("SELECT COUNT(*) AS c FROM trades WHERE status = 'success' AND action != 'NONE'").get() as {
        c: number;
      }
    ).c;
    const winCount = (
      this.db
        .prepare("SELECT COUNT(*) AS c FROM trades WHERE status = 'success' AND action = 'CLOSE' AND pnl > 0")
        .get() as { c: number }
    ).c;
    const lossCount = (
      this.db
        .prepare("SELECT COUNT(*) AS c FROM trades WHERE status = 'success' AND action = 'CLOSE' AND pnl <= 0")
        .get() as { c: number }
    ).c;
    const failedExecutions = (
      this.db.prepare("SELECT COUNT(*) AS c FROM trades WHERE status = 'failed'").get() as { c: number }
    ).c;

    return { decisionCount, tradeCount, totalTrades, winCount, lossCount, failedExecutions };
  }

  close(): void {
    this.db.close();
  }
}
