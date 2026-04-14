import { Router } from "express";
import { pingMongo } from "../db/mongo.js";

export const createHealthRouter = (): Router => {
  const router = Router();

  router.get("/health", async (_req, res) => {
    const connected = await pingMongo();

    res.status(connected ? 200 : 503).json({
      status: connected ? "ok" : "degraded",
      dependencies: {
        mongodb: connected ? "connected" : "disconnected"
      },
      timestamp: new Date().toISOString()
    });
  });

  return router;
};
