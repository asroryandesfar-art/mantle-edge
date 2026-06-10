import { z } from "zod";

/** Directional call produced by the MarketAnalystAgent for a single asset. */
export const SignalDirectionSchema = z.enum(["LONG", "SHORT", "WAIT"]);
export type SignalDirection = z.infer<typeof SignalDirectionSchema>;

/** Technical indicators computed for an asset at signal time. */
export const MarketIndicatorsSchema = z.object({
  rsi14: z.number().nullable(),
  ema20: z.number().nullable(),
  ema50: z.number().nullable(),
  volumeAnomaly: z.number().nullable(),
});
export type MarketIndicators = z.infer<typeof MarketIndicatorsSchema>;

/** Output of the MarketAnalystAgent for a single asset. */
export const MarketSignalSchema = z.object({
  asset: z.string().min(3),
  direction: SignalDirectionSchema,
  confidence: z.number().min(0).max(100),
  reasoning: z.string().min(1),
  /** Reference price (quote per base). 0 if market data was unavailable. */
  price: z.number().nonnegative(),
  indicators: MarketIndicatorsSchema,
  timestamp: z.number().int().positive(),
});
export type MarketSignal = z.infer<typeof MarketSignalSchema>;

/** Action the RiskManagerAgent has cleared (or rejected) for execution. */
export const RiskActionSchema = z.enum(["OPEN_LONG", "OPEN_SHORT", "CLOSE", "NONE"]);
export type RiskAction = z.infer<typeof RiskActionSchema>;

/** Output of the RiskManagerAgent for a single asset. */
export const TradeDecisionSchema = z.object({
  asset: z.string().min(3),
  approved: z.boolean(),
  action: RiskActionSchema,
  /** Position size in USD notional. 0 when not approved. */
  size: z.number().nonnegative(),
  /** Absolute stop-loss price. 0 when not applicable. */
  stopLoss: z.number().nonnegative(),
  reason: z.string().min(1),
  signal: MarketSignalSchema,
});
export type TradeDecision = z.infer<typeof TradeDecisionSchema>;

/** A single open paper-trading position. */
export interface OpenPosition {
  asset: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  /** USD notional size committed to this position. */
  size: number;
  stopLoss: number;
  openedAt: number;
}

/** Snapshot of the paper-trading portfolio used by the RiskManagerAgent. */
export interface PortfolioState {
  /** Total account value (cash + open position notional). */
  equity: number;
  /** Free cash not allocated to open positions. */
  cash: number;
  /** Equity at the start of the current UTC day, for the daily loss limit. */
  dayStartEquity: number;
  /** Cumulative realized PnL across all closed trades. */
  realizedPnl: number;
  positions: OpenPosition[];
}

/** Outcome of the ExecutorAgent attempting to act on a TradeDecision. */
export const ExecutionStatusSchema = z.enum(["success", "failed", "skipped", "none"]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export interface ExecutionResult {
  status: ExecutionStatus;
  asset: string;
  action: RiskAction;
  price: number;
  /** USD notional involved in this execution. */
  size: number;
  /** Realized PnL in USD, set when action === "CLOSE". */
  pnl?: number;
  /** On-chain swap transaction hash, if a real DEX trade was executed. */
  txHash?: string;
  /** On-chain LogRegistry transaction hash, if logging succeeded. */
  logTxHash?: string;
  error?: string;
  timestamp: number;
}
