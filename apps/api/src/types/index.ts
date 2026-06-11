/** Direction/action the agent decided to take for a given asset. */
export type DecisionAction = "LONG" | "SHORT" | "WAIT";

/** Direction of an opened position. */
export type TradeDirection = "LONG" | "SHORT";

/** Lifecycle state of a trade. */
export type TradeStatus = "OPEN" | "CLOSED";

/** Operational state of the trading agent. */
export type AgentStatusState = "RUNNING" | "IDLE" | "STOPPED" | "ERROR";

/** A single row of the `decisions` table. */
export interface Decision {
  id: number;
  timestamp: string;
  asset: string;
  action: DecisionAction;
  confidence: number;
  reasoning: string;
  price: number;
  createdAt: string;
}

/** Payload accepted by `POST /api/decisions`. */
export interface CreateDecisionInput {
  timestamp?: string;
  asset: string;
  action: DecisionAction;
  confidence: number;
  reasoning: string;
  price: number;
}

/** A single row of the `trades` table. */
export interface Trade {
  id: number;
  timestamp: string;
  asset: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number | null;
  size: number;
  pnl: number | null;
  status: TradeStatus;
  confidence: number;
  txHash: string | null;
  closedAt: string | null;
  createdAt: string;
}

/** Payload accepted by `POST /api/trades`. */
export interface CreateTradeInput {
  timestamp?: string;
  asset: string;
  direction: TradeDirection;
  entryPrice: number;
  size: number;
  confidence?: number;
  txHash?: string;
}

/** Payload accepted by `PATCH /api/trades/:id/close`. */
export interface CloseTradeInput {
  exitPrice: number;
  closedAt?: string;
}

/** The single-row `agent_status` table, tracking the agent's overall operational state. */
export interface AgentStatus {
  status: AgentStatusState;
  lastHeartbeat: string | null;
  uptimeSeconds: number;
  currentBalance: number;
  startingBalance: number;
  updatedAt: string;
}

/** Payload accepted by `POST /api/agent/heartbeat`. */
export interface HeartbeatInput {
  status?: AgentStatusState;
  currentBalance?: number;
  uptimeSeconds?: number;
}

/** Aggregated performance metrics returned by `GET /api/metrics`. */
export interface Metrics {
  totalDecisions: number;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnl: number;
  totalPnlPct: number;
  avgConfidence: number;
  currentBalance: number;
  startingBalance: number;
}

/** Generic paginated list response shape used by list endpoints. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

/** Standard error response shape returned by the error-handling middleware. */
export interface ErrorResponse {
  error: string;
  code: string;
}
