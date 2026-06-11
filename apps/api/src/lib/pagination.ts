const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parses `limit`/`offset` query parameters, clamping `limit` to
 * `[1, 100]` (default 20) and `offset` to `>= 0` (default 0). Invalid or
 * missing values fall back to the defaults rather than erroring, since
 * pagination params are optional on every list endpoint.
 */
export function parsePagination(query: Record<string, unknown>): { limit: number; offset: number } {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);

  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}
