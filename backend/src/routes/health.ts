import { Router } from "express";
import { pingMongo } from "../db/mongo.js";
import { pingPostgres } from "../db/postgres.js";

export const createHealthRouter = (): Router => {
  const router = Router();

  router.get("/health", async (_req, res) => {
    const [mongoConnected, postgresConnected] = await Promise.all([pingMongo(), pingPostgres()]);
    const connected = mongoConnected && postgresConnected;
    const reachable = mongoConnected || postgresConnected;

    res.status(reachable ? 200 : 503).json({
      status: connected ? "ok" : "degraded",
      dependencies: {
        mongodb: mongoConnected ? "connected" : "disconnected",
        postgresql: postgresConnected ? "connected" : "disconnected"
      },
      timestamp: new Date().toISOString()
    });
  });

  return router;
};
