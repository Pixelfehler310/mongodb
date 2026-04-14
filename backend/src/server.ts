import { createLogger } from "./config/logger.js";
import { getConfig } from "./config/env.js";
import { createApp } from "./app.js";
import { closeMongo, connectToMongo, getDb } from "./db/mongo.js";
import { seedProducts } from "./db/seed.js";
import { ensureProductIndexes } from "./db/indexes.js";

const startServer = async (): Promise<void> => {
  const config = getConfig();
  const logger = createLogger(config.logLevel);

  await connectToMongo(config.mongodbUri, config.mongodbDbName, logger);
  await ensureProductIndexes(getDb(), logger);

  if (config.seedOnStart) {
    const seedResult = await seedProducts(getDb(), {
      count: 120,
      clearExisting: true
    });

    logger.info(seedResult, "Seeded demo products on startup");
  }

  const app = createApp(config, logger);
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "Backend server listening");
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down gracefully");
    server.close(async () => {
      await closeMongo();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
};

startServer().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error", error);
  process.exit(1);
});
