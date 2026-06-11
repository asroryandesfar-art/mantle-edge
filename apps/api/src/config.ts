import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

/** Walks up from `startDir` until a `pnpm-workspace.yaml` is found (the monorepo root). */
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

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "https://dashboard-pi-flax-19.vercel.app",
  "https://dashboard-cyv1nwpom-asroryandesfar-2477s-projects.vercel.app",
];

/**
 * Parses a comma-separated list of CORS origins from `CORS_ORIGINS`, falling
 * back to the local dashboard dev server and the production Vercel URL.
 */
function parseCorsOrigins(value: string | undefined): string[] {
  if (!value || value.trim().length === 0) return DEFAULT_CORS_ORIGINS;
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/** Mantle chain IDs we recognize for display purposes. */
const MANTLE_NETWORK_NAMES: Record<string, string> = {
  "5000": "Mantle",
  "5003": "Mantle Sepolia Testnet",
};

export const config = {
  monorepoRoot,
  /** Port the Express server listens on. Defaults to 3002 (apps/agent's health server already owns 3001). */
  port: Number.parseInt(process.env.PORT ?? "3002", 10),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  /** Path to the SQLite database file. */
  dbPath: path.join(monorepoRoot, "apps/api/data/mantle-edge.db"),
  /** Path to the dashboard's static feed file, kept in sync after every write. */
  agentFeedPath: path.join(monorepoRoot, "apps/dashboard/public/data/agent-feed.json"),
  /** Read-only RPC endpoint used to fetch live gas price and identity data. */
  mantleRpcUrl: process.env.MANTLE_RPC_URL ?? "https://rpc.sepolia.mantle.xyz",
  /** Human-readable name of the configured Mantle network, e.g. "Mantle Sepolia Testnet". */
  mantleNetworkName: MANTLE_NETWORK_NAMES[process.env.MANTLE_CHAIN_ID ?? "5003"] ?? "Mantle",
  /** Public address of the trading agent's wallet (no private key needed here). */
  agentAddress: process.env.AGENT_ADDRESS ?? "-",
  /** Deployed AgentIdentityNFT contract address, if available. */
  agentIdentityNftAddress: process.env.AGENT_IDENTITY_NFT_ADDRESS,
};
