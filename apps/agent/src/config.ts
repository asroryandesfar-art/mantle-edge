import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { MANTLE_MAINNET } from "@mantle-edge/shared";

/** Walks up from `startDir` until a `pnpm-workspace.yaml` is found. */
function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

const monorepoRoot = findMonorepoRoot(process.cwd());

// Load shared root `.env` first, then allow an app-local `.env` to override it.
loadDotenv({ path: path.join(monorepoRoot, ".env") });
loadDotenv({ path: path.join(process.cwd(), ".env"), override: true });

const envSchema = z.object({
  MANTLE_RPC_URL: z.string().url().default(MANTLE_MAINNET.rpcUrl),
  MANTLE_CHAIN_ID: z.coerce.number().int().positive().default(MANTLE_MAINNET.chainId),

  AGENT_PRIVATE_KEY: z.string().min(1, "AGENT_PRIVATE_KEY is required"),

  BYBIT_API_KEY: z.string().default(""),
  BYBIT_SECRET: z.string().default(""),
  BYBIT_TESTNET: z.coerce.boolean().default(false),

  OPENAI_API_KEY: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),

  TRADING_PAIR: z.string().default("MNT/USDT"),
  BYBIT_SYMBOL: z.string().default("MNTUSDT"),
  AGENT_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  MAX_TRADE_SIZE_USD: z.coerce.number().positive().default(25),
  MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),
  EXECUTION_VENUE: z.enum(["dex", "cex"]).default("dex"),

  AGENT_IDENTITY_REGISTRY_ADDRESS: z.string().default(""),
  AGENT_METADATA_URI: z.string().default(""),
  LOG_REGISTRY_ADDRESS: z.string().default(""),

  // --- Multi-agent trading system -----------------------------------------
  STARTING_EQUITY_USD: z.coerce.number().positive().default(1000),
  RISK_MAX_POSITION_PCT: z.coerce.number().min(0).max(1).default(0.2),
  RISK_STOP_LOSS_PCT: z.coerce.number().min(0).max(1).default(0.05),
  RISK_DAILY_LOSS_LIMIT_PCT: z.coerce.number().min(0).max(1).default(0.15),
  ORCHESTRATOR_CYCLE_MS: z.coerce.number().int().positive().default(5 * 60_000),
  REPORTER_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),

  DATA_DIR: z.string().default("data"),

  // --- Health check server -------------------------------------------------
  PORT: z.coerce.number().int().positive().default(3001),

  // --- apps/api bridge -------------------------------------------------------
  // Base URL of the @mantle-edge/api server (apps/api), which persists
  // decisions/trades/agent status and refreshes the dashboard's
  // agent-feed.json. Defaults to apps/api's default port (3002); this app's
  // own health server already owns port 3001.
  API_URL: z.string().url().default("http://localhost:3002"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = {
  monorepoRoot,
  dataDir: path.isAbsolute(env.DATA_DIR) ? env.DATA_DIR : path.join(monorepoRoot, env.DATA_DIR),
  mantle: {
    rpcUrl: env.MANTLE_RPC_URL,
    chainId: env.MANTLE_CHAIN_ID,
  },
  wallet: {
    privateKey: (env.AGENT_PRIVATE_KEY.startsWith("0x")
      ? env.AGENT_PRIVATE_KEY
      : `0x${env.AGENT_PRIVATE_KEY}`) as `0x${string}`,
  },
  bybit: {
    apiKey: env.BYBIT_API_KEY,
    apiSecret: env.BYBIT_SECRET,
    testnet: env.BYBIT_TESTNET,
    symbol: env.BYBIT_SYMBOL,
  },
  llm: {
    openaiApiKey: env.OPENAI_API_KEY || undefined,
    anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
    anthropicModel: env.ANTHROPIC_MODEL,
  },
  trading: {
    pair: env.TRADING_PAIR,
    pollIntervalMs: env.AGENT_POLL_INTERVAL_MS,
    maxTradeSizeUsd: env.MAX_TRADE_SIZE_USD,
    minConfidence: env.MIN_CONFIDENCE,
    venue: env.EXECUTION_VENUE,
  },
  identity: {
    registryAddress: env.AGENT_IDENTITY_REGISTRY_ADDRESS || undefined,
    metadataUri: env.AGENT_METADATA_URI || undefined,
  },
  logRegistry: {
    address: env.LOG_REGISTRY_ADDRESS || undefined,
  },
  portfolio: {
    startingEquityUsd: env.STARTING_EQUITY_USD,
  },
  risk: {
    maxPositionPct: env.RISK_MAX_POSITION_PCT,
    stopLossPct: env.RISK_STOP_LOSS_PCT,
    dailyLossLimitPct: env.RISK_DAILY_LOSS_LIMIT_PCT,
  },
  orchestrator: {
    cycleIntervalMs: env.ORCHESTRATOR_CYCLE_MS,
    reporterIntervalMs: env.REPORTER_INTERVAL_MS,
  },
  server: {
    port: env.PORT,
  },
  api: {
    url: env.API_URL,
  },
};

export type Config = typeof config;
