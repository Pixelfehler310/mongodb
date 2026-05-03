import { Router } from "express";
import { parseDatabaseMode } from "../db/database-mode.js";
import { getCategories } from "../services/products-dual.js";

export const createCategoriesRouter = (): Router => {
  const router = Router();

  router.get("/categories", async (req, res, next) => {
    try {
      const dbMode = parseDatabaseMode(req.query.db);
      const categories = await getCategories(dbMode);
      res.json({
        data: categories,
        count: categories.length
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
