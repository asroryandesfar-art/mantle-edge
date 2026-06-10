import express from "express";
import { existsSync, readFileSync } from "node:fs";
import type { Server } from "node:http";
import path from "node:path";
import { config } from "./config.js";
import { createLogger } from "./logger.js";

const logger = createLogger("healthServer");

/** Same path the ReporterAgent writes to (see multiagent/reporter.ts). */
const FEED_PATH = path.join(config.monorepoRoot, "apps/dashboard/public/data/agent-feed.json");

/**
 * Starts a minimal Express server exposing:
 * - `/health` for uptime checks (Railway/Render/Docker)
 * - `/agent-feed.json` so a separately-deployed dashboard can poll this
 *   agent's live state (CORS-enabled, never cached)
 */
export function startHealthServer(): Server {
  const app = express();
  const startedAt = Date.now();

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/agent-feed.json", (_req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "no-store");

    if (!existsSync(FEED_PATH)) {
      res.status(404).json({ error: "agent feed not yet generated" });
      return;
    }

    res.type("application/json").send(readFileSync(FEED_PATH, "utf-8"));
  });

  const server = app.listen(config.server.port, () => {
    logger.info("health server listening", { port: config.server.port });
  });

  return server;
}
