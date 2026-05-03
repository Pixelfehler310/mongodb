import { Router } from "express";
import { parseSeedTarget } from "../db/database-mode.js";
import { seedDatabases } from "../db/seed-dual.js";
import { seedInputSchema } from "../validation/schemas.js";

export const createSeedRouter = (): Router => {
  const router = Router();

  router.post("/seed", async (req, res, next) => {
    try {
      const target = parseSeedTarget(req.query.db);
      const payload = seedInputSchema.parse(req.body);
      const result = await seedDatabases(target, {
        count: payload?.count ?? 120,
        clearExisting: payload?.clear_existing ?? true,
        seed: 20260503
      });

      res.json({
        success: true,
        target: result.target,
        inserted_count: result.totalInsertedCount,
        cleared: Object.values(result.results).some((item) => item.cleared),
        results: result.results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
