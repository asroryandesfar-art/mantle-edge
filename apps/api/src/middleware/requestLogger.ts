import type { NextFunction, Request, Response } from "express";

/** Logs every incoming request as `[ISO timestamp] METHOD /path`. */
export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
}
