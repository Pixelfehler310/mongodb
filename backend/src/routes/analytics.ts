import { Router } from "express";
import { getAnalytics } from "../services/products.js";

export const createAnalyticsRouter = (): Router => {
  const router = Router();

  router.get("/analytics", async (_req, res, next) => {
    try {
      const analytics = await getAnalytics();
      res.json(analytics);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
