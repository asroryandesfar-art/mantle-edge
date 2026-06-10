import { sleep } from "@mantle-edge/shared";
import { config } from "./config.js";
import { createLogger } from "./logger.js";
import { provider, wallet } from "./chain/provider.js";
import { bybit } from "./exchanges/bybit.js";
import { decide } from "./strategy/decision.js";
import { executeDecision } from "./trading/executor.js";
import { agentIdentity } from "./identity/agentIdentity.js";
import { appendDecisionLog, appendTradeLog } from "./storage/tradeLogStore.js";

const logger = createLogger("agent");

/** Candle interval (minutes) used for the strategy's price history. */
const KLINE_INTERVAL = "60";
/** Number of candles fetched, must exceed the strategy's longest lookback (30). */
const KLINE_LIMIT = 60;

let shuttingDown = false;

async function tick(): Promise<void> {
  const ticker = await bybit.getTicker(config.bybit.symbol);
  const klines = await bybit.getKlines(config.bybit.symbol, KLINE_INTERVAL, KLINE_LIMIT);
  const closes = klines.map((k) => k.close);

  const decision = decide({
    pair: config.trading.pair,
    venue: config.trading.venue,
    closes,
    currentPrice: ticker.lastPrice,
    maxTradeSizeUsd: config.trading.maxTradeSizeUsd,
  });

  logger.info("decision", { ...decision });
  await appendDecisionLog(decision);

  const trade = await executeDecision(decision);
  if (trade) {
    await appendTradeLog(trade);
  }
}

async function main(): Promise<void> {
  const network = await provider.getNetwork();
  logger.info("agent starting", {
    address: wallet.address,
    chainId: Number(network.chainId),
    pair: config.trading.pair,
    venue: config.trading.venue,
    pollIntervalMs: config.trading.pollIntervalMs,
  });

  try {
    const identity = await agentIdentity.ensureRegistered();
    if (identity) logger.info("agent identity", { ...identity });
  } catch (error) {
    logger.warn("agent identity registration skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  while (!shuttingDown) {
    try {
      await tick();
    } catch (error) {
      logger.error("tick failed", { error: error instanceof Error ? error.message : String(error) });
    }
    await sleep(config.trading.pollIntervalMs);
  }
}

function shutdown(signal: string): void {
  logger.info("shutting down", { signal });
  shuttingDown = true;
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((error) => {
  logger.error("fatal error", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
