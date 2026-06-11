import { Router, type Router as ExpressRouter } from "express";
import { db } from "../db/client.js";
import { writeAgentFeed } from "../lib/agentFeed.js";
import { parsePagination } from "../lib/pagination.js";
import { ApiError } from "../middleware/errorHandler.js";
import type { CloseTradeInput, CreateTradeInput, TradeDirection, TradeStatus } from "../types/index.js";

export const tradesRouter: ExpressRouter = Router();

const VALID_DIRECTIONS: TradeDirection[] = ["LONG", "SHORT"];
const VALID_STATUSES: TradeStatus[] = ["OPEN", "CLOSED"];

/**
 * GET /api/trades
 *
 * Returns a paginated list of trades, most recent first.
 *
 * Query params:
 * - `limit` (optional, default 20, max 100)
 * - `offset` (optional, default 0)
 * - `status` (optional, "OPEN" | "CLOSED") - filters by trade lifecycle state
 *
 * Response: `{ data: Trade[], total: number, hasMore: boolean }`
 */
tradesRouter.get("/", (req, res) => {
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const statusParam = req.query.status;

  let status: TradeStatus | undefined;
  if (statusParam !== undefined) {
    if (typeof statusParam !== "string" || !VALID_STATUSES.includes(statusParam as TradeStatus)) {
      throw new ApiError(400, "VALIDATION_ERROR", "`status` must be one of OPEN, CLOSED");
    }
    status = statusParam as TradeStatus;
  }

  res.json(db.listTrades(limit, offset, status));
});

/**
 * POST /api/trades
 *
 * Opens a new trade.
 *
 * Request body:
 * - `asset` (string, required)
 * - `direction` ("LONG" | "SHORT", required)
 * - `entryPrice` (number, required)
 * - `size` (number, required) - position size in USD
 * - `confidence` (number, optional, default 0)
 * - `txHash` (string, optional) - on-chain transaction hash, if executed
 * - `timestamp` (string, optional, ISO 8601) - defaults to now
 *
 * The trade is created with `status: "OPEN"`. Response: the created `Trade`
 * (HTTP 201). Also triggers `writeAgentFeed()` to refresh the dashboard's
 * static feed snapshot.
 */
tradesRouter.post("/", (req, res) => {
  const body = req.body as Partial<CreateTradeInput>;

  if (typeof body.asset !== "string" || body.asset.trim().length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "`asset` is required and must be a non-empty string");
  }
  if (typeof body.direction !== "string" || !VALID_DIRECTIONS.includes(body.direction as TradeDirection)) {
    throw new ApiError(400, "VALIDATION_ERROR", "`direction` is required and must be one of LONG, SHORT");
  }
  if (typeof body.entryPrice !== "number" || !Number.isFinite(body.entryPrice) || body.entryPrice <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "`entryPrice` is required and must be a positive number");
  }
  if (typeof body.size !== "number" || !Number.isFinite(body.size) || body.size <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "`size` is required and must be a positive number");
  }
  if (body.confidence !== undefined && (typeof body.confidence !== "number" || !Number.isFinite(body.confidence))) {
    throw new ApiError(400, "VALIDATION_ERROR", "`confidence` must be a number when provided");
  }
  if (body.txHash !== undefined && typeof body.txHash !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "`txHash` must be a string when provided");
  }
  if (body.timestamp !== undefined && (typeof body.timestamp !== "string" || Number.isNaN(Date.parse(body.timestamp)))) {
    throw new ApiError(400, "VALIDATION_ERROR", "`timestamp` must be a valid ISO 8601 string when provided");
  }

  const trade = db.createTrade({
    timestamp: body.timestamp,
    asset: body.asset,
    direction: body.direction as TradeDirection,
    entryPrice: body.entryPrice,
    size: body.size,
    confidence: body.confidence,
    txHash: body.txHash,
  });

  writeAgentFeed();
  res.status(201).json(trade);
});

/**
 * PATCH /api/trades/:id/close
 *
 * Closes an open trade at a given exit price, computing realized PnL based
 * on the trade's direction and size.
 *
 * Request body:
 * - `exitPrice` (number, required)
 * - `closedAt` (string, optional, ISO 8601) - defaults to now
 *
 * Response: the updated `Trade`. Returns 404 if no trade with that id
 * exists, and 409 if the trade has already been closed. Also triggers
 * `writeAgentFeed()` to refresh the dashboard's static feed snapshot.
 */
tradesRouter.patch("/:id/close", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "`id` must be a positive integer");
  }

  const body = req.body as Partial<CloseTradeInput>;
  if (typeof body.exitPrice !== "number" || !Number.isFinite(body.exitPrice) || body.exitPrice <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "`exitPrice` is required and must be a positive number");
  }
  if (body.closedAt !== undefined && (typeof body.closedAt !== "string" || Number.isNaN(Date.parse(body.closedAt)))) {
    throw new ApiError(400, "VALIDATION_ERROR", "`closedAt` must be a valid ISO 8601 string when provided");
  }

  const result = db.closeTrade(id, { exitPrice: body.exitPrice, closedAt: body.closedAt });

  if (result === null) {
    throw new ApiError(404, "NOT_FOUND", `No trade found with id ${id}`);
  }
  if (result === "already-closed") {
    throw new ApiError(409, "ALREADY_CLOSED", `Trade ${id} has already been closed`);
  }

  writeAgentFeed();
  res.json(result);
});
