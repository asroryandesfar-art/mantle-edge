import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { provider, wallet } from "../chain/provider.js";
import { config } from "../config.js";
import { createLogger } from "../logger.js";
import type { TradingDb } from "./db.js";
import type { MarketSignal } from "./types.js";

const logger = createLogger("multiagent:reporter");

const OUTPUT_PATH = path.join(config.monorepoRoot, "apps/dashboard/public/data/agent-feed.json");

const startedAt = Date.now();

function formatUptime(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export interface ReporterContext {
  /** Latest signals from the most recent MarketAnalystAgent run, used to mark open positions to market. */
  latestSignals: MarketSignal[];
}

/**
 * Aggregates portfolio state, decisions, and trades from SQLite into the
 * dashboard's `agent-feed.json` schema and writes it to
 * `apps/dashboard/public/data/agent-feed.json`. Never throws.
 */
export async function runReporter(db: TradingDb, ctx: ReporterContext): Promise<void> {
  try {
    const portfolio = db.getPortfolioState();
    const stats = db.getStats();
    const decisions = db.getRecentDecisions(20);
    const trades = db.getRecentTrades(20);

    const pnlPct = ((portfolio.equity - config.portfolio.startingEquityUsd) / config.portfolio.startingEquityUsd) * 100;
    const totalClosed = stats.winCount + stats.lossCount;
    const winRate = totalClosed > 0 ? (stats.winCount / totalClosed) * 100 : 0;
    const confidenceAvg =
      decisions.length > 0 ? decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length : 0;

    const openPosition = portfolio.positions[0] ?? null;
    const positionSignal = openPosition ? ctx.latestSignals.find((s) => s.asset === openPosition.asset) : undefined;
    const roa =
      openPosition && positionSignal && positionSignal.price > 0
        ? (openPosition.direction === "LONG" ? 1 : -1) *
          ((positionSignal.price - openPosition.entryPrice) / openPosition.entryPrice) *
          100
        : 0;

    let gasPrice = "n/a";
    try {
      const feeData = await provider.getFeeData();
      if (feeData.gasPrice !== null) {
        gasPrice = `${(Number(feeData.gasPrice) / 1e9).toFixed(4)} Gwei`;
      }
    } catch (err) {
      logger.debug("failed to fetch gas price", { error: err instanceof Error ? err.message : String(err) });
    }

    const feed = {
      status: "LIVE",
      uptime: formatUptime(Date.now() - startedAt),
      terminalId: "MNT-EDGE-MULTIAGENT",
      gasPrice,
      agentAddress: wallet.address,
      apiLatencyMs: 0,
      position: openPosition
        ? {
            pair: openPosition.asset,
            direction: openPosition.direction,
            size: `${openPosition.size.toFixed(2)} USD`,
            leverage: "1x",
            roa: formatPct(roa),
          }
        : {
            pair: config.trading.pair,
            direction: "WAIT",
            size: "0.00 USD",
            leverage: "1x",
            roa: "+0.00%",
          },
      comparison: {
        yourPnl: "+0.00%",
        agentPnl: formatPct(pnlPct),
        edge: formatPct(pnlPct),
      },
      metrics: {
        pnl: formatPct(pnlPct),
        winRate: `${winRate.toFixed(0)}%`,
        tradeCount: stats.tradeCount,
        confidenceAvg: Math.round(confidenceAvg),
        failedExecutions: stats.failedExecutions,
        agentContributionPct: 100,
        agentContributionTrades: stats.tradeCount,
      },
      decisions: decisions.map((d) => ({
        time: new Date(d.timestamp).toISOString(),
        action: d.direction,
        asset: d.asset,
        reasoning: d.reasoning,
        confidence: Math.round(d.confidence),
      })),
      trades: trades.map((t) => ({
        time: new Date(t.timestamp).toISOString(),
        asset: t.asset,
        direction: t.action,
        confidence: 0,
        size: `${t.size.toFixed(2)} USD`,
        entryPrice: t.price.toString(),
        exitPrice: t.action === "CLOSE" ? t.price.toString() : "-",
        pnl: t.pnl !== null ? formatPct((t.pnl / t.size) * 100) : "-",
        txHash: t.txHash ?? t.logTxHash ?? "-",
      })),
      identity: {
        name: "MantleEdge Multi-Agent",
        tokenId: "-",
        identifier: `did:mantle:agent:${wallet.address}`,
        valueManaged: `$${portfolio.equity.toFixed(2)}`,
        birthBlock: "-",
        authorizedSchemes: ["ERC-8004", "EIP-712"],
        uptimeSignature: "-",
        totalTrades: stats.tradeCount.toString(),
        totalPnl: formatPct(pnlPct),
        owner: wallet.address,
        trustScore: Math.round(confidenceAvg),
        metadata: {
          strategy: "Multi-Agent: Analyst -> RiskManager -> Executor -> Reporter",
          model: config.llm.anthropicApiKey ? config.llm.anthropicModel : "rule-based fallback",
          network: "Mantle Network",
        },
      },
    };

    const dir = path.dirname(OUTPUT_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(feed, null, 2));

    logger.info("wrote agent feed", { path: OUTPUT_PATH, equity: portfolio.equity, tradeCount: stats.tradeCount });
  } catch (err) {
    logger.error("failed to write agent feed", { error: err instanceof Error ? err.message : String(err) });
  }
}
