import { Router, type Router as ExpressRouter } from "express";
import { db } from "../db/client.js";
import { writeAgentFeed } from "../lib/agentFeed.js";
import { parsePagination } from "../lib/pagination.js";
import { ApiError } from "../middleware/errorHandler.js";
import type { CreateDecisionInput, DecisionAction } from "../types/index.js";

export const decisionsRouter: ExpressRouter = Router();

const VALID_ACTIONS: DecisionAction[] = ["LONG", "SHORT", "WAIT"];

/**
 * GET /api/decisions
 *
 * Returns a paginated list of agent decisions, most recent first.
 *
 * Query params:
 * - `limit` (optional, default 20, max 100)
 * - `offset` (optional, default 0)
 *
 * Response: `{ data: Decision[], total: number, hasMore: boolean }`
 */
decisionsRouter.get("/", (req, res) => {
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  res.json(db.listDecisions(limit, offset));
});

/**
 * POST /api/decisions
 *
 * Records a new agent decision.
 *
 * Request body:
 * - `asset` (string, required)
 * - `action` ("LONG" | "SHORT" | "WAIT", required)
 * - `confidence` (number, required) - confidence score, expected 0-100
 * - `reasoning` (string, required)
 * - `price` (number, required) - reference price at decision time
 * - `timestamp` (string, optional, ISO 8601) - defaults to now
 *
 * Response: the created `Decision` (HTTP 201). Also triggers
 * `writeAgentFeed()` to refresh the dashboard's static feed snapshot.
 */
decisionsRouter.post("/", (req, res) => {
  const body = req.body as Partial<CreateDecisionInput>;

  if (typeof body.asset !== "string" || body.asset.trim().length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "`asset` is required and must be a non-empty string");
  }
  if (typeof body.action !== "string" || !VALID_ACTIONS.includes(body.action as DecisionAction)) {
    throw new ApiError(400, "VALIDATION_ERROR", "`action` is required and must be one of LONG, SHORT, WAIT");
  }
  if (typeof body.confidence !== "number" || !Number.isFinite(body.confidence)) {
    throw new ApiError(400, "VALIDATION_ERROR", "`confidence` is required and must be a number");
  }
  if (typeof body.reasoning !== "string" || body.reasoning.trim().length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "`reasoning` is required and must be a non-empty string");
  }
  if (typeof body.price !== "number" || !Number.isFinite(body.price)) {
    throw new ApiError(400, "VALIDATION_ERROR", "`price` is required and must be a number");
  }
  if (body.timestamp !== undefined && (typeof body.timestamp !== "string" || Number.isNaN(Date.parse(body.timestamp)))) {
    throw new ApiError(400, "VALIDATION_ERROR", "`timestamp` must be a valid ISO 8601 string when provided");
  }

  const decision = db.createDecision({
    timestamp: body.timestamp,
    asset: body.asset,
    action: body.action as DecisionAction,
    confidence: body.confidence,
    reasoning: body.reasoning,
    price: body.price,
  });

  writeAgentFeed();
  res.status(201).json(decision);
});
