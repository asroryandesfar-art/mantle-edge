import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import type { ErrorResponse } from "../types/index.js";

/**
 * Error type that route handlers can throw to control the HTTP status code
 * and machine-readable `code` returned to the client. Any other thrown
 * value is treated as an unexpected internal error (HTTP 500).
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** 404 helper for unmatched routes. Mounted after all other routes. */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  const body: ErrorResponse = { error: `Route not found: ${req.method} ${req.path}`, code: "NOT_FOUND" };
  res.status(404).json(body);
}

/**
 * Centralized error-handling middleware. Converts `ApiError` instances into
 * their declared HTTP status and code, and falls back to a generic 500 for
 * anything else (including synchronous throws and rejected promises passed
 * via `next(err)`).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    const body: ErrorResponse = { error: err.message, code: err.code };
    res.status(err.statusCode).json(body);
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  console.error(`[error] ${message}`, err instanceof Error ? err.stack : err);
  const body: ErrorResponse = { error: message, code: "INTERNAL_ERROR" };
  res.status(500).json(body);
};
