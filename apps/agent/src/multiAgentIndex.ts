import { provider, wallet } from "./chain/provider.js";
import { config } from "./config.js";
import { startHealthServer } from "./healthServer.js";
import { createLogger } from "./logger.js";
import { startOrchestrator } from "./multiagent/orchestrator.js";

const logger = createLogger("multiagent");

async function main(): Promise<void> {
  const network = await provider.getNetwork();
  logger.info("multi-agent trading system starting", {
    address: wallet.address,
    chainId: Number(network.chainId),
    pairs: ["BTC/USDT", "ETH/USDT", "MNT/USDT"],
    startingEquityUsd: config.portfolio.startingEquityUsd,
    cycleIntervalMs: config.orchestrator.cycleIntervalMs,
  });

  const healthServer = startHealthServer();
  const stop = await startOrchestrator();

  const shutdown = (signal: string): void => {
    logger.info("shutting down", { signal, time: new Date().toISOString() });
    stop();
    healthServer.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error("fatal error", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
