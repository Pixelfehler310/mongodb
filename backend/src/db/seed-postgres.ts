import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { ProductAttributeValue } from "../types/domain.js";
import { generateSeedProducts, type SeedOptions } from "./seed.js";

const insertAttribute = async (
  client: PoolClient,
  productId: string,
  key: string,
  value: ProductAttributeValue
): Promise<void> => {
  const valueType = typeof value;

  await client.query(
    `
      INSERT INTO product_attributes (
        product_id, attr_key, value_type, value_text, value_number, value_boolean
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      productId,
      key,
      valueType,
      valueType === "string" ? value : null,
      valueType === "number" ? value : null,
      valueType === "boolean" ? value : null
    ]
  );
};

export const seedPostgresProducts = async (
  pool: Pool,
  options: SeedOptions
): Promise<{ insertedCount: number; cleared: boolean }> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (options.clearExisting) {
      await client.query("TRUNCATE reviews, product_tags, product_attributes, products RESTART IDENTITY CASCADE");
    }

    const docs = generateSeedProducts(options.count, options.seed);

    for (const doc of docs) {
      const productId = randomUUID();

      await client.query(
        `
          INSERT INTO products (
            id, sku, name, description, price, category, stock, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          productId,
          doc.sku,
          doc.name,
          doc.description,
          doc.price,
          doc.category,
          doc.stock,
          doc.created_at,
          doc.updated_at
        ]
      );

      for (const [key, value] of Object.entries(doc.attributes)) {
        await insertAttribute(client, productId, key, value);
      }

      for (const tag of doc.tags) {
        await client.query("INSERT INTO product_tags (product_id, tag) VALUES ($1, $2)", [productId, tag]);
      }

      for (const review of doc.reviews) {
        await client.query(
          `
            INSERT INTO reviews (id, product_id, user_name, rating, comment, date)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [randomUUID(), productId, review.user, review.rating, review.comment, review.date]
        );
      }
    }

    await client.query("COMMIT");

    return {
      insertedCount: docs.length,
      cleared: options.clearExisting
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};