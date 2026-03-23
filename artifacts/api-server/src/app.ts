import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { initializeDatabase } from "./lib/db-init.js";
import { loadAgentsFromDisk } from "./lib/agent-loader.js";
import { globalErrorHandler, setupProcessErrorHandlers } from "./lib/error-handler.js";
import { mcpManager } from "./lib/mcp/mcp-manager.js";

// Setup process-level error handlers (unhandledRejection, uncaughtException)
setupProcessErrorHandlers();

// Initialize SQLite tables and load agents on startup
try {
  initializeDatabase();
  logger.info("Database initialized");
  loadAgentsFromDisk().then((count) => {
    logger.info({ count }, "Agents loaded from disk");
  }).catch((err) => {
    logger.warn({ err }, "Could not load agents from disk");
  });
  // Connect to active MCP servers
  mcpManager.connectAll().catch((err) => {
    logger.warn({ err }, "MCP servers initialization had issues");
  });
} catch (err) {
  logger.error({ err }, "Failed to initialize database");
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global error handler (must be last middleware)
app.use(globalErrorHandler);

export default app;

