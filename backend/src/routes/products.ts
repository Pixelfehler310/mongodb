import { Router } from "express";
import {
  addProductReview,
  createProduct,
  getProductById,
  listProducts
} from "../services/products-dual.js";
import { parseDatabaseMode } from "../db/database-mode.js";
import { createProductInputSchema, reviewInputSchema } from "../validation/schemas.js";

export const createProductsRouter = (): Router => {
  const router = Router();

  router.get("/products", async (req, res, next) => {
    try {
      const dbMode = parseDatabaseMode(req.query.db);
      const result = await listProducts(dbMode, req.query as Record<string, unknown>);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/products/:id", async (req, res, next) => {
    try {
      const dbMode = parseDatabaseMode(req.query.db);
      const product = await getProductById(dbMode, req.params.id);
      res.json(product);
    } catch (error) {
      next(error);
    }
  });

  router.post("/products", async (req, res, next) => {
    try {
      const dbMode = parseDatabaseMode(req.query.db);
      const payload = createProductInputSchema.parse(req.body);
      const product = await createProduct(dbMode, payload);

      res.status(201).json({
        success: true,
        message: "Product created",
        product
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/products/:id/reviews", async (req, res, next) => {
    try {
      const dbMode = parseDatabaseMode(req.query.db);
      const review = reviewInputSchema.parse(req.body);
      const product = await addProductReview(dbMode, req.params.id, review);
      res.status(201).json({
        success: true,
        message: "Review added",
        product
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
