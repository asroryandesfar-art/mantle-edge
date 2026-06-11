import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { agentRouter } from "./routes/agent.js";
import { decisionsRouter } from "./routes/decisions.js";
import { feedRouter } from "./routes/feed.js";
import { metricsRouter } from "./routes/metrics.js";
import { tradesRouter } from "./routes/trades.js";

const app = express();

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());
app.use(requestLogger);

/**
 * GET /health
 *
 * Liveness probe for uptime monitors and container orchestrators. Always
 * returns HTTP 200 if the process is up and able to handle requests.
 *
 * Response: `{ status: "ok", timestamp: string }`
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/agent", agentRouter);
app.use("/api/decisions", decisionsRouter);
app.use("/api/trades", tradesRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/feed", feedRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[${new Date().toISOString()}] @mantle-edge/api listening on port ${config.port}`);
  console.log(`[${new Date().toISOString()}] CORS origins: ${config.corsOrigins.join(", ")}`);
  console.log(`[${new Date().toISOString()}] Database: ${config.dbPath}`);
});
