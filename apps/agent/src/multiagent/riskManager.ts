import { config } from "../config.js";
import { createLogger } from "../logger.js";
import type { MarketSignal, OpenPosition, PortfolioState, TradeDecision } from "./types.js";

const logger = createLogger("multiagent:risk");

/** Minimum confidence (0-100) required for the RiskManagerAgent to open a new position. */
const MIN_CONFIDENCE = 60;

/** Minimum USD notional worth opening a position for. */
const MIN_TRADE_SIZE_USD = 1;

/** True if `price` has crossed `position.stopLoss` against the position's direction. */
function isStopLossBreached(position: OpenPosition, price: number): boolean {
  if (price <= 0) return false;
  return position.direction === "LONG" ? price <= position.stopLoss : price >= position.stopLoss;
}

/** Computes the stop-loss price for a new position opened at `entryPrice`. */
function computeStopLoss(direction: "LONG" | "SHORT", entryPrice: number): number {
  return direction === "LONG"
    ? entryPrice * (1 - config.risk.stopLossPct)
    : entryPrice * (1 + config.risk.stopLossPct);
}

/**
 * Applies portfolio risk rules to a single MarketSignal:
 * - max `RISK_MAX_POSITION_PCT` of equity per new trade
 * - stop-loss at `RISK_STOP_LOSS_PCT` from entry
 * - blocks new positions once the daily loss limit (`RISK_DAILY_LOSS_LIMIT_PCT`) is breached
 *
 * Pure function: never throws, never performs I/O.
 */
export function assessRisk(signal: MarketSignal, portfolio: PortfolioState): TradeDecision {
  const existing = portfolio.positions.find((p) => p.asset === signal.asset) ?? null;

  // 1. An open position whose stop-loss has been hit must always be closed first.
  if (existing && isStopLossBreached(existing, signal.price)) {
    return {
      asset: signal.asset,
      approved: true,
      action: "CLOSE",
      size: existing.size,
      stopLoss: existing.stopLoss,
      reason: `Stop-loss triggered: price ${signal.price} crossed ${existing.stopLoss.toFixed(6)} for ${existing.direction} position`,
      signal,
    };
  }

  // 2. A signal opposing an open position closes it to manage risk (re-entry happens next cycle).
  if (existing && signal.direction !== "WAIT" && signal.direction !== existing.direction) {
    return {
      asset: signal.asset,
      approved: true,
      action: "CLOSE",
      size: existing.size,
      stopLoss: existing.stopLoss,
      reason: `Signal reversed to ${signal.direction}; closing existing ${existing.direction} position to manage risk`,
      signal,
    };
  }

  // 3. Already holding a position that still agrees with the signal: nothing to do.
  if (existing) {
    return {
      asset: signal.asset,
      approved: false,
      action: "NONE",
      size: 0,
      stopLoss: existing.stopLoss,
      reason: `Already holding a ${existing.direction} position in ${signal.asset}; no action needed`,
      signal,
    };
  }

  // 4. No position and no actionable signal.
  if (signal.direction === "WAIT") {
    return {
      asset: signal.asset,
      approved: false,
      action: "NONE",
      size: 0,
      stopLoss: 0,
      reason: "No actionable signal (WAIT)",
      signal,
    };
  }

  // 5. Daily loss limit: block new entries once breached, but allow closes (handled above).
  const dailyPnlPct =
    portfolio.dayStartEquity > 0 ? (portfolio.equity - portfolio.dayStartEquity) / portfolio.dayStartEquity : 0;
  if (dailyPnlPct <= -config.risk.dailyLossLimitPct) {
    logger.warn("Daily loss limit breached, rejecting new entries", {
      asset: signal.asset,
      dailyPnlPct,
      limit: -config.risk.dailyLossLimitPct,
    });
    return {
      asset: signal.asset,
      approved: false,
      action: "NONE",
      size: 0,
      stopLoss: 0,
      reason: `Daily loss limit reached (${(dailyPnlPct * 100).toFixed(2)}% <= -${(config.risk.dailyLossLimitPct * 100).toFixed(2)}%); no new positions today`,
      signal,
    };
  }

  // 6. Confidence threshold.
  if (signal.confidence < MIN_CONFIDENCE) {
    return {
      asset: signal.asset,
      approved: false,
      action: "NONE",
      size: 0,
      stopLoss: 0,
      reason: `Confidence ${signal.confidence} below minimum ${MIN_CONFIDENCE}`,
      signal,
    };
  }

  // 7. Size the trade: at most RISK_MAX_POSITION_PCT of equity, capped by available cash.
  const maxByEquity = portfolio.equity * config.risk.maxPositionPct;
  const size = Math.min(maxByEquity, portfolio.cash);
  if (size < MIN_TRADE_SIZE_USD) {
    return {
      asset: signal.asset,
      approved: false,
      action: "NONE",
      size: 0,
      stopLoss: 0,
      reason: `Insufficient free cash to open a position (available $${portfolio.cash.toFixed(2)})`,
      signal,
    };
  }

  const stopLoss = computeStopLoss(signal.direction, signal.price);
  return {
    asset: signal.asset,
    approved: true,
    action: signal.direction === "LONG" ? "OPEN_LONG" : "OPEN_SHORT",
    size,
    stopLoss,
    reason: `Approved: ${signal.direction} ${signal.asset} sized at $${size.toFixed(2)} (${((size / portfolio.equity) * 100).toFixed(1)}% of equity), confidence ${signal.confidence}, stop-loss at ${stopLoss.toFixed(6)}`,
    signal,
  };
}
