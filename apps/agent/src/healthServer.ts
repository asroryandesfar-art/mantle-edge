import express from "express";
import type { Server } from "node:http";
import { config } from "./config.js";
import { createLogger } from "./logger.js";

const logger = createLogger("healthServer");

/** Starts a minimal Express server exposing `/health` for uptime checks (Railway/Render/Docker). */
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

  const server = app.listen(config.server.port, () => {
    logger.info("health server listening", { port: config.server.port });
  });

  return server;
}
