import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getChainSnapshot } from "./chain.js";
import { config } from "../config.js";
import { db } from "../db/client.js";

/** Formats a duration in seconds as `XdYhZm`, matching the dashboard's uptime display. */
function formatUptime(totalSeconds: number): string {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

/** Formats a numeric percentage with an explicit `+`/`-` sign, e.g. `+1.23%`. */
function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** The JSON shape the Next.js dashboard polls via `agent-feed.json` / `GET /api/feed`. */
export interface AgentFeed {
  status: string;
  uptime: string;
  terminalId: string;
  gasPrice: string;
  agentAddress: string;
  apiLatencyMs: number;
  position: {
    pair: string;
    direction: string;
    size: string;
    leverage: string;
    roa: string;
  };
  comparison: {
    yourPnl: string;
    agentPnl: string;
    edge: string;
  };
  metrics: {
    pnl: string;
    winRate: string;
    tradeCount: number;
    totalTrades: number;
    confidenceAvg: number;
    failedExecutions: number;
    agentContributionPct: number;
    agentContributionTrades: number;
  };
  tickers: Array<{ symbol: string; price: number; changeVsEma20Pct: number }>;
  decisions: Array<{ time: string; action: string; asset: string; reasoning: string; confidence: number }>;
  trades: Array<{
    time: string;
    asset: string;
    direction: string;
    confidence: number;
    size: string;
    entryPrice: string;
    exitPrice: string;
    pnl: string;
    txHash: string;
  }>;
  identity: {
    name: string;
    tokenId: string;
    identifier: string;
    valueManaged: string;
    birthBlock: string;
    authorizedSchemes: string[];
    uptimeSignature: string;
    totalTrades: string;
    totalPnl: string;
    owner: string;
    trustScore: number;
    metadata: { strategy: string; model: string; network: string };
  };
}

/**
 * Aggregates the current `decisions`, `trades`, and `agent_status` tables
 * into the JSON shape the Next.js dashboard polls (`agent-feed.json`).
 */
export function buildFeed(): AgentFeed {
  const status = db.getAgentStatus();
  const metrics = db.getMetrics();
  const decisions = db.getRecentDecisions(20);
  const trades = db.getRecentTrades(20);

  const openTrade = trades.find((t) => t.status === "OPEN") ?? null;
  const chain = getChainSnapshot();

  return {
    status: status.status,
    uptime: formatUptime(status.uptimeSeconds),
    terminalId: "MNT-EDGE-API",
    gasPrice: chain.gasPrice,
    agentAddress: chain.agentAddress,
    apiLatencyMs: 0,
    position: openTrade
      ? {
          pair: openTrade.asset,
          direction: openTrade.direction,
          size: `${openTrade.size.toFixed(2)} USD`,
          leverage: "1x",
          roa: "+0.00%",
        }
      : {
          pair: "MNT/USDT",
          direction: "WAIT",
          size: "0.00 USD",
          leverage: "1x",
          roa: "+0.00%",
        },
    comparison: {
      yourPnl: "+0.00%",
      agentPnl: formatPct(metrics.totalPnlPct),
      edge: formatPct(metrics.totalPnlPct),
    },
    metrics: {
      pnl: formatPct(metrics.totalPnlPct),
      winRate: `${metrics.winRate.toFixed(0)}%`,
      tradeCount: metrics.closedTrades,
      totalTrades: metrics.totalTrades,
      confidenceAvg: Math.round(metrics.avgConfidence),
      failedExecutions: 0,
      agentContributionPct: 100,
      agentContributionTrades: metrics.closedTrades,
    },
    tickers: [],
    decisions: decisions.map((d) => ({
      time: d.timestamp,
      action: d.action,
      asset: d.asset,
      reasoning: d.reasoning,
      confidence: Math.round(d.confidence),
    })),
    trades: trades.map((t) => ({
      time: t.timestamp,
      asset: t.asset,
      direction: t.direction,
      confidence: Math.round(t.confidence),
      size: `${t.size.toFixed(2)} USD`,
      entryPrice: t.entryPrice.toString(),
      exitPrice: t.exitPrice !== null ? t.exitPrice.toString() : "-",
      pnl: t.pnl !== null ? formatPct((t.pnl / t.size) * 100) : "-",
      txHash: t.txHash ?? "-",
    })),
    identity: {
      name: "MantleEdge API Agent",
      tokenId: chain.identity?.tokenId ?? "-",
      identifier: "did:mantle:agent:api",
      valueManaged: `$${metrics.currentBalance.toFixed(2)}`,
      birthBlock: chain.identity?.birthBlock ?? "-",
      authorizedSchemes: ["ERC-8004", "EIP-712"],
      uptimeSignature: "-",
      totalTrades: metrics.totalTrades.toString(),
      totalPnl: formatPct(metrics.totalPnlPct),
      owner: chain.identity?.owner ?? "-",
      trustScore: Math.round(metrics.avgConfidence),
      metadata: {
        strategy: "Multi-Agent: Analyst -> RiskManager -> Executor -> Reporter",
        model: "rule-based fallback",
        network: chain.network,
      },
    },
  };
}

/**
 * Builds the current feed and writes it to
 * `apps/dashboard/public/data/agent-feed.json`, kept for backward
 * compatibility with the dashboard's existing SWR polling. Never throws (a
 * write failure is logged and otherwise ignored).
 */
export function writeAgentFeed(): void {
  try {
    const feed = buildFeed();
    const dir = path.dirname(config.agentFeedPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(config.agentFeedPath, JSON.stringify(feed, null, 2));
  } catch (err) {
    console.error(`[agentFeed] failed to write feed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
