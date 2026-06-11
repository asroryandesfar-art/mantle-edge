import { Router, type Router as ExpressRouter } from "express";
import { db } from "../db/client.js";

export const metricsRouter: ExpressRouter = Router();

/**
 * GET /api/metrics
 *
 * Returns aggregated performance metrics computed from the `decisions` and
 * `trades` tables: trade/decision counts, win rate, realized PnL (absolute
 * and as a percentage of starting balance), and average decision
 * confidence.
 *
 * Response: `Metrics`
 */
metricsRouter.get("/", (_req, res) => {
  res.json(db.getMetrics());
});
