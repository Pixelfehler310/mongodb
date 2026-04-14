import type { Db } from "mongodb";
import type { Logger } from "pino";

export const ensureProductIndexes = async (db: Db, logger: Logger): Promise<void> => {
  const collection = db.collection("products");

  await collection.createIndex({ sku: 1 }, { unique: true, name: "sku_unique" });
  await collection.createIndex({ category: 1 }, { name: "category_idx" });
  await collection.createIndex({ price: 1 }, { name: "price_idx" });
  await collection.createIndex({ stock: 1 }, { name: "stock_idx" });
  await collection.createIndex({ "attributes.$**": 1 }, { name: "attributes_wildcard_idx" });
  await collection.createIndex({ name: "text", description: "text", tags: "text" }, { name: "products_text_idx" });

  logger.info("Product indexes ensured");
};
