import type { AppConfig } from "../config/env.js";
import { Router } from "express";
import { createAnalyticsRouter } from "./analytics.js";
import { createCategoriesRouter } from "./categories.js";
import { createHealthRouter } from "./health.js";
import { createPerformanceRouter } from "./performance.js";
import { createProductsRouter } from "./products.js";
import { createSeedRouter } from "./seed.js";

export const createApiRouter = (config: AppConfig): Router => {
  const router = Router();

  router.use(createHealthRouter());
  router.use(createProductsRouter());
  router.use(createCategoriesRouter());
  router.use(createAnalyticsRouter());
  router.use(createSeedRouter());
  router.use(createPerformanceRouter(config));

  return router;
};
