import { isMongoConnected } from "../db/mongo.js";
import { isPostgresConnected } from "../db/postgres.js";
import type { DatabaseMode } from "../db/database-mode.js";
import type {
  ProductAttributeValue,
  ProductListResponse,
  ProductResponse,
  ReviewDoc
} from "../types/domain.js";
import { HttpError } from "../utils/http-error.js";
import * as mongoProducts from "./products.js";
import * as postgresProducts from "./products-postgres.js";

const ensureDatabaseAvailable = (mode: DatabaseMode): void => {
  if (mode === "mongo" && !isMongoConnected()) {
    throw new HttpError(503, "DATABASE_UNAVAILABLE", "MongoDB is not connected");
  }

  if (mode === "postgres" && !isPostgresConnected()) {
    throw new HttpError(503, "DATABASE_UNAVAILABLE", "PostgreSQL is not connected");
  }
};

export const listProducts = async (
  mode: DatabaseMode,
  query: Record<string, unknown>
): Promise<ProductListResponse> => {
  ensureDatabaseAvailable(mode);
  return mode === "postgres" ? postgresProducts.listProducts(query) : mongoProducts.listProducts(query);
};

export const createProduct = async (
  mode: DatabaseMode,
  input: {
    sku: string;
    name: string;
    description: string;
    price: number;
    category: string;
    stock: number;
    attributes: Record<string, ProductAttributeValue>;
    tags: string[];
  }
): Promise<ProductResponse> => {
  ensureDatabaseAvailable(mode);
  return mode === "postgres" ? postgresProducts.createProduct(input) : mongoProducts.createProduct(input);
};

export const getProductById = async (mode: DatabaseMode, id: string): Promise<ProductResponse> => {
  ensureDatabaseAvailable(mode);
  return mode === "postgres" ? postgresProducts.getProductById(id) : mongoProducts.getProductById(id);
};

export const addProductReview = async (
  mode: DatabaseMode,
  id: string,
  review: Omit<ReviewDoc, "date"> & { date?: Date }
): Promise<ProductResponse> => {
  ensureDatabaseAvailable(mode);
  return mode === "postgres"
    ? postgresProducts.addProductReview(id, review)
    : mongoProducts.addProductReview(id, review);
};

export const getCategories = async (mode: DatabaseMode): Promise<string[]> => {
  ensureDatabaseAvailable(mode);
  return mode === "postgres" ? postgresProducts.getCategories() : mongoProducts.getCategories();
};

export const getAnalytics = async (mode: DatabaseMode): ReturnType<typeof mongoProducts.getAnalytics> => {
  ensureDatabaseAvailable(mode);
  return mode === "postgres" ? postgresProducts.getAnalytics() : mongoProducts.getAnalytics();
};