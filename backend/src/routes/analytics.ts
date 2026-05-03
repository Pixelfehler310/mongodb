import { Router } from "express";
import { parseDatabaseMode } from "../db/database-mode.js";
import { getAnalytics } from "../services/products-dual.js";

export const createAnalyticsRouter = (): Router => {
  const router = Router();

  router.get("/analytics", async (req, res, next) => {
    try {
      const dbMode = parseDatabaseMode(req.query.db);
      const analytics = await getAnalytics(dbMode);
      res.json(analytics);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
