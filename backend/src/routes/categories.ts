import { Router } from "express";
import { getCategories } from "../services/products.js";

export const createCategoriesRouter = (): Router => {
  const router = Router();

  router.get("/categories", async (_req, res, next) => {
    try {
      const categories = await getCategories();
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
