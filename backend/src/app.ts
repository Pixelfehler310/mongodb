import cors from "cors";
import express from "express";
import type { AppConfig } from "./config/env.js";
import type { Logger } from "pino";
import { createErrorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { createApiRouter } from "./routes/index.js";

export const createApp = (config: AppConfig, logger: Logger) => {
  const app = express();

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info(
        {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - start
        },
        "HTTP request"
      );
    });
    next();
  });

  app.use(
    cors({
      origin: config.corsOrigin
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/v1", createApiRouter());

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
};
