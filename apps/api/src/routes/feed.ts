import { Router, type Router as ExpressRouter } from "express";
import { buildFeed } from "../lib/agentFeed.js";

export const feedRouter: ExpressRouter = Router();

/**
 * GET /api/feed
 *
 * Returns a single aggregated snapshot of the agent's current state -
 * status, position, metrics, recent decisions, recent trades, and identity -
 * in the same shape as `apps/dashboard/public/data/agent-feed.json`. This is
 * the live equivalent of that static file, computed on demand from the
 * current database state.
 *
 * Response: `AgentFeed`
 */
feedRouter.get("/", (_req, res) => {
  res.json(buildFeed());
});
