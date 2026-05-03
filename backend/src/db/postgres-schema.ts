import type { Pool } from "pg";
import type { Logger } from "pino";

export const ensurePostgresSchema = async (pool: Pool, logger: Logger): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
      category TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK (stock >= 0),
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_attributes (
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      attr_key TEXT NOT NULL,
      value_type TEXT NOT NULL CHECK (value_type IN ('string', 'number', 'boolean')),
      value_text TEXT,
      value_number NUMERIC,
      value_boolean BOOLEAN,
      PRIMARY KEY (product_id, attr_key)
    );

    CREATE TABLE IF NOT EXISTS product_tags (
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (product_id, tag)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      date TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
    CREATE INDEX IF NOT EXISTS products_price_idx ON products(price);
    CREATE INDEX IF NOT EXISTS products_stock_idx ON products(stock);
    CREATE INDEX IF NOT EXISTS products_created_at_idx ON products(created_at);
    CREATE INDEX IF NOT EXISTS product_attributes_key_text_idx ON product_attributes(attr_key, value_text);
    CREATE INDEX IF NOT EXISTS product_attributes_key_number_idx ON product_attributes(attr_key, value_number);
    CREATE INDEX IF NOT EXISTS product_attributes_key_boolean_idx ON product_attributes(attr_key, value_boolean);
    CREATE INDEX IF NOT EXISTS product_tags_tag_idx ON product_tags(tag);
    CREATE INDEX IF NOT EXISTS reviews_product_id_idx ON reviews(product_id);
  `);

  logger.info("PostgreSQL product schema ensured");
};