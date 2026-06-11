import { config } from "../config.js";
import { createLogger } from "../logger.js";
import type { TradingDb } from "./db.js";
import type { ExecutionResult, MarketSignal } from "./types.js";

const logger = createLogger("multiagent:reporter");

const startedAt = Date.now();

/** Tracks the apps/api trade id for each asset's currently open position, so CLOSE executions can PATCH the right record. */
const openTradeIds = new Map<string, number>();

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${config.api.url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn("apps/api request failed", { path, status: res.status, body: await res.text().catch(() => "") });
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    logger.warn("apps/api request errored", { path, error: errorMessage(err) });
    return null;
  }
}

async function patchJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${config.api.url}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn("apps/api request failed", { path, status: res.status, body: await res.text().catch(() => "") });
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    logger.warn("apps/api request errored", { path, error: errorMessage(err) });
    return null;
  }
}

/** Reports a MarketAnalystAgent signal to apps/api as a new decision. Returns the created decision's id, or null on failure. */
export async function reportDecision(signal: MarketSignal): Promise<number | null> {
  const created = await postJson<{ id: number }>("/api/decisions", {
    timestamp: new Date(signal.timestamp).toISOString(),
    asset: signal.asset,
    action: signal.direction,
    confidence: signal.confidence,
    reasoning: signal.reasoning,
    price: signal.price,
  });
  return created?.id ?? null;
}

/** Reports an ExecutorAgent result to apps/api: opens a new trade record, or closes the tracked open trade for this asset. */
export async function reportTrade(result: ExecutionResult, decisionId: number | null): Promise<void> {
  if (result.action === "OPEN_LONG" || result.action === "OPEN_SHORT") {
    const created = await postJson<{ id: number }>("/api/trades", {
      timestamp: new Date(result.timestamp).toISOString(),
      asset: result.asset,
      direction: result.action === "OPEN_LONG" ? "LONG" : "SHORT",
      entryPrice: result.price,
      size: result.size,
      confidence: result.confidence ?? 0,
      txHash: result.txHash,
      decisionId: decisionId ?? undefined,
    });
    if (created) openTradeIds.set(result.asset, created.id);
    return;
  }

  if (result.action === "CLOSE") {
    const tradeId = openTradeIds.get(result.asset);
    if (tradeId === undefined) {
      logger.debug("no tracked apps/api trade for CLOSE, skipping", { asset: result.asset });
      return;
    }
    await patchJson(`/api/trades/${tradeId}/close`, {
      exitPrice: result.price,
      closedAt: new Date(result.timestamp).toISOString(),
    });
    openTradeIds.delete(result.asset);
  }
}

/** Starts a periodic heartbeat that reports portfolio status to apps/api. Returns a function to stop the loop. */
export function startHeartbeatLoop(db: TradingDb): () => void {
  const sendHeartbeat = async (): Promise<void> => {
    const portfolio = db.getPortfolioState();
    await postJson("/api/agent/heartbeat", {
      status: "RUNNING",
      currentBalance: portfolio.equity,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    });
  };

  void sendHeartbeat();
  const timer = setInterval(() => void sendHeartbeat(), config.orchestrator.reporterIntervalMs);
  return () => clearInterval(timer);
}
