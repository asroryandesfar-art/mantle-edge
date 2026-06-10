type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel = (process.env.LOG_LEVEL ?? "info") as Level;
const threshold = LEVELS[configuredLevel] ?? LEVELS.info;

function emit(level: Level, scope: string, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < threshold) return;

  const entry = {
    time: new Date().toISOString(),
    level,
    scope,
    message,
    ...meta,
  };
  const line = JSON.stringify(entry);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Creates a JSON-line logger namespaced under `scope`. Set LOG_LEVEL to control verbosity. */
export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => emit("debug", scope, message, meta),
    info: (message: string, meta?: Record<string, unknown>) => emit("info", scope, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => emit("warn", scope, message, meta),
    error: (message: string, meta?: Record<string, unknown>) => emit("error", scope, message, meta),
  };
}
