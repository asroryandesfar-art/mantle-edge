import path from "node:path";
import { config } from "../config.js";
import { createLogger } from "../logger.js";
import { TradingDb } from "./db.js";
import { runExecutor } from "./executorAgent.js";
import { runMarketAnalyst } from "./marketAnalyst.js";
import { reportDecision, reportTrade, startHeartbeatLoop } from "./reporter.js";
import { assessRisk } from "./riskManager.js";

const logger = createLogger("multiagent:orchestrator");

const DB_PATH = path.join(config.dataDir, "trading.db");

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Runs Analyst -> RiskManager -> Executor for every watched asset, reporting results to apps/api. Never throws. */
async function runCycle(db: TradingDb): Promise<void> {
  logger.info("cycle started", { time: new Date().toISOString() });

  let signals;
  try {
    signals = await runMarketAnalyst();
  } catch (err) {
    logger.error("MarketAnalystAgent failed, skipping this cycle", { error: errorMessage(err) });
    return;
  }

  for (const signal of signals) {
    try {
      const portfolio = db.getPortfolioState();
      const decision = assessRisk(signal, portfolio);
      db.recordDecision(signal, decision);

      logger.info("decision", {
        time: new Date().toISOString(),
        asset: signal.asset,
        signal: signal.direction,
        confidence: signal.confidence,
        price: signal.price,
        approved: decision.approved,
        action: decision.action,
        size: decision.size,
        reason: decision.reason,
      });

      const decisionId = await reportDecision(signal);

      if (decision.approved && decision.action !== "NONE") {
        const result = await runExecutor(decision, db);

        logger.info("execution", {
          time: new Date().toISOString(),
          asset: result.asset,
          action: result.action,
          status: result.status,
          pnl: result.pnl,
          txHash: result.txHash,
          logTxHash: result.logTxHash,
          error: result.error,
        });

        await reportTrade(result, decisionId);
      }
    } catch (err) {
      logger.error("pipeline step failed for asset, continuing with remaining assets", {
        asset: signal.asset,
        error: errorMessage(err),
      });
    }
  }

  logger.info("cycle complete", { time: new Date().toISOString() });
}

/**
 * Starts the multi-agent trading loop: Analyst -> RiskManager -> Executor ->
 * apps/api every `ORCHESTRATOR_CYCLE_MS`, plus an independent heartbeat to
 * apps/api every `REPORTER_INTERVAL_MS`. Returns a function that stops both
 * loops and closes the database.
 */
export async function startOrchestrator(): Promise<() => void> {
  const db = new TradingDb(DB_PATH, config.portfolio.startingEquityUsd);

  logger.info("orchestrator starting", {
    dbPath: DB_PATH,
    cycleIntervalMs: config.orchestrator.cycleIntervalMs,
    reporterIntervalMs: config.orchestrator.reporterIntervalMs,
    startingEquityUsd: config.portfolio.startingEquityUsd,
  });

  await runCycle(db);

  const cycleTimer = setInterval(() => {
    void runCycle(db);
  }, config.orchestrator.cycleIntervalMs);

  const stopHeartbeat = startHeartbeatLoop(db);

  return () => {
    clearInterval(cycleTimer);
    stopHeartbeat();
    db.close();
  };
}
