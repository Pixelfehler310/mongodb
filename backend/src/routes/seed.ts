import { Router } from "express";
import { getDb } from "../db/mongo.js";
import { seedProducts } from "../db/seed.js";
import { seedInputSchema } from "../validation/schemas.js";

export const createSeedRouter = (): Router => {
  const router = Router();

  router.post("/seed", async (req, res, next) => {
    try {
      const payload = seedInputSchema.parse(req.body);
      const result = await seedProducts(getDb(), {
        count: payload?.count ?? 120,
        clearExisting: payload?.clear_existing ?? true
      });

      res.json({
        success: true,
        inserted_count: result.insertedCount,
        cleared: result.cleared,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
