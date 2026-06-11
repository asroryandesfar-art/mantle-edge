import { Router, type Router as ExpressRouter } from "express";
import { db } from "../db/client.js";
import { writeAgentFeed } from "../lib/agentFeed.js";
import { ApiError } from "../middleware/errorHandler.js";
import type { AgentStatusState, HeartbeatInput } from "../types/index.js";

export const agentRouter: ExpressRouter = Router();

const VALID_STATUSES: AgentStatusState[] = ["RUNNING", "IDLE", "STOPPED", "ERROR"];

/**
 * GET /api/agent/status
 *
 * Returns the agent's current operational state, including its last
 * heartbeat time, uptime, and balance snapshot.
 *
 * Response: `AgentStatus`
 */
agentRouter.get("/status", (_req, res) => {
  res.json(db.getAgentStatus());
});

/**
 * POST /api/agent/heartbeat
 *
 * Records a heartbeat from the trading agent, updating its operational
 * status and `lastHeartbeat` timestamp to now.
 *
 * Request body (all fields optional):
 * - `status` ("RUNNING" | "IDLE" | "STOPPED" | "ERROR") - defaults to "RUNNING"
 * - `currentBalance` (number) - latest portfolio balance in USD
 * - `uptimeSeconds` (number) - agent process uptime in seconds
 *
 * Response: the updated `AgentStatus`. Also triggers `writeAgentFeed()` to
 * refresh the dashboard's static feed snapshot.
 */
agentRouter.post("/heartbeat", (req, res) => {
  const body = req.body as Partial<HeartbeatInput>;

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as AgentStatusState)) {
    throw new ApiError(400, "VALIDATION_ERROR", "`status` must be one of RUNNING, IDLE, STOPPED, ERROR");
  }
  if (body.currentBalance !== undefined && (typeof body.currentBalance !== "number" || !Number.isFinite(body.currentBalance))) {
    throw new ApiError(400, "VALIDATION_ERROR", "`currentBalance` must be a number when provided");
  }
  if (body.uptimeSeconds !== undefined && (typeof body.uptimeSeconds !== "number" || !Number.isFinite(body.uptimeSeconds) || body.uptimeSeconds < 0)) {
    throw new ApiError(400, "VALIDATION_ERROR", "`uptimeSeconds` must be a non-negative number when provided");
  }

  const status = db.recordHeartbeat({
    status: body.status as AgentStatusState | undefined,
    currentBalance: body.currentBalance,
    uptimeSeconds: body.uptimeSeconds,
  });

  writeAgentFeed();
  res.json(status);
});
