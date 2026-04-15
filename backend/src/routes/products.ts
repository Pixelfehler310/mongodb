import { Router } from "express";
import {
  addProductReview,
  createProduct,
  getProductById,
  listProducts
} from "../services/products.js";
import { createProductInputSchema, reviewInputSchema } from "../validation/schemas.js";

export const createProductsRouter = (): Router => {
  const router = Router();

  router.get("/products", async (req, res, next) => {
    try {
      const result = await listProducts(req.query as Record<string, unknown>);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/products/:id", async (req, res, next) => {
    try {
      const product = await getProductById(req.params.id);
      res.json(product);
    } catch (error) {
      next(error);
    }
  });

  router.post("/products", async (req, res, next) => {
    try {
      const payload = createProductInputSchema.parse(req.body);
      const product = await createProduct(payload);

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
      const review = reviewInputSchema.parse(req.body);
      const product = await addProductReview(req.params.id, review);
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
