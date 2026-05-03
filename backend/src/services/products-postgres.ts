import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPostgresPool } from "../db/postgres.js";
import type {
  ProductAttributeValue,
  ProductListResponse,
  ProductResponse,
  ReviewDoc
} from "../types/domain.js";
import { HttpError } from "../utils/http-error.js";

type SortDirection = "ASC" | "DESC";

type ParsedListOptions = {
  whereSql: string;
  params: unknown[];
  sortSql: string;
  sortDirection: SortDirection;
  limit: number;
  offset: number;
  appliedFilters: Record<string, unknown>;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: string;
  category: string;
  stock: number;
  created_at: Date;
  updated_at: Date;
};

type AttributeRow = {
  product_id: string;
  attr_key: string;
  value_type: "string" | "number" | "boolean";
  value_text: string | null;
  value_number: string | null;
  value_boolean: boolean | null;
};

type TagRow = {
  product_id: string;
  tag: string;
};

type ReviewRow = {
  product_id: string;
  user_name: string;
  rating: number;
  comment: string;
  date: Date;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseMaybeNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return undefined;
};

const parseFlexibleValue = (value: string): ProductAttributeValue => {
  const lower = value.toLowerCase();
  if (lower === "true") {
    return true;
  }
  if (lower === "false") {
    return false;
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && value.trim() !== "") {
    return asNumber;
  }

  return value;
};

const toSingleString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string");
  }

  return undefined;
};

const parseSort = (value: string | undefined): { sortSql: string; direction: SortDirection } => {
  if (!value) {
    return { sortSql: "p.created_at", direction: "DESC" };
  }

  const normalized = value.trim();
  const isDesc = normalized.startsWith("-");
  const field = isDesc ? normalized.slice(1) : normalized;

  const allowedFields: Record<string, string> = {
    name: "p.name",
    price: "p.price",
    stock: "p.stock",
    category: "p.category",
    created_at: "p.created_at",
    updated_at: "p.updated_at"
  };

  const sortSql = allowedFields[field];
  if (!sortSql) {
    throw new HttpError(400, "INVALID_SORT_FIELD", `Unsupported sort field: ${field}`);
  }

  return { sortSql, direction: isDesc ? "DESC" : "ASC" };
};

const addParam = (params: unknown[], value: unknown): string => {
  params.push(value);
  return `$${params.length}`;
};

const attributePredicate = (
  params: unknown[],
  attrKey: string,
  value: ProductAttributeValue
): string => {
  const keyParam = addParam(params, attrKey);
  const valueParam = addParam(params, value);

  if (typeof value === "number") {
    return `EXISTS (
      SELECT 1 FROM product_attributes pa_filter
      WHERE pa_filter.product_id = p.id
        AND pa_filter.attr_key = ${keyParam}
        AND pa_filter.value_type = 'number'
        AND pa_filter.value_number = ${valueParam}
    )`;
  }

  if (typeof value === "boolean") {
    return `EXISTS (
      SELECT 1 FROM product_attributes pa_filter
      WHERE pa_filter.product_id = p.id
        AND pa_filter.attr_key = ${keyParam}
        AND pa_filter.value_type = 'boolean'
        AND pa_filter.value_boolean = ${valueParam}
    )`;
  }

  return `EXISTS (
    SELECT 1 FROM product_attributes pa_filter
    WHERE pa_filter.product_id = p.id
      AND pa_filter.attr_key = ${keyParam}
      AND pa_filter.value_type = 'string'
      AND pa_filter.value_text = ${valueParam}
  )`;
};

const parseListOptions = (query: Record<string, unknown>): ParsedListOptions => {
  const params: unknown[] = [];
  const where: string[] = [];
  const appliedFilters: Record<string, unknown> = {};

  const category = toSingleString(query.category);
  if (category) {
    where.push(`p.category = ${addParam(params, category)}`);
    appliedFilters.category = category;
  }

  const search = toSingleString(query.search);
  if (search) {
    const searchParam = addParam(params, `%${search}%`);
    where.push(`(
      p.name ILIKE ${searchParam}
      OR p.description ILIKE ${searchParam}
      OR EXISTS (
        SELECT 1 FROM product_tags pt_search
        WHERE pt_search.product_id = p.id AND pt_search.tag ILIKE ${searchParam}
      )
    )`);
    appliedFilters.search = search;
  }

  const priceGt = parseMaybeNumber(query.price_gt);
  const priceGte = parseMaybeNumber(query.price_gte);
  const priceLt = parseMaybeNumber(query.price_lt);
  const priceLte = parseMaybeNumber(query.price_lte);
  const priceFilter: Record<string, number> = {};

  if (priceGt !== undefined) {
    where.push(`p.price > ${addParam(params, priceGt)}`);
    priceFilter.$gt = priceGt;
  }
  if (priceGte !== undefined) {
    where.push(`p.price >= ${addParam(params, priceGte)}`);
    priceFilter.$gte = priceGte;
  }
  if (priceLt !== undefined) {
    where.push(`p.price < ${addParam(params, priceLt)}`);
    priceFilter.$lt = priceLt;
  }
  if (priceLte !== undefined) {
    where.push(`p.price <= ${addParam(params, priceLte)}`);
    priceFilter.$lte = priceLte;
  }
  if (Object.keys(priceFilter).length > 0) {
    appliedFilters.price = priceFilter;
  }

  const inStock = toSingleString(query.in_stock);
  if (inStock && ["true", "false"].includes(inStock.toLowerCase())) {
    const enabled = inStock.toLowerCase() === "true";
    where.push(enabled ? "p.stock > 0" : "p.stock <= 0");
    appliedFilters.in_stock = enabled;
  }

  for (const [key, rawValue] of Object.entries(query)) {
    const str = toSingleString(rawValue);
    if (!str) {
      continue;
    }

    if (key.startsWith("attributes.")) {
      const attrKey = key.slice("attributes.".length);
      if (attrKey) {
        where.push(attributePredicate(params, attrKey, parseFlexibleValue(str)));
        appliedFilters[key] = str;
      }
    }

    const bracket = key.match(/^attributes\[(.+)\]$/);
    if (bracket?.[1]) {
      const attrKey = bracket[1];
      where.push(attributePredicate(params, attrKey, parseFlexibleValue(str)));
      appliedFilters[`attributes.${attrKey}`] = str;
    }
  }

  const nestedAttributes = query.attributes;
  if (nestedAttributes && typeof nestedAttributes === "object" && !Array.isArray(nestedAttributes)) {
    for (const [key, rawValue] of Object.entries(nestedAttributes)) {
      const str = toSingleString(rawValue);
      if (!str) {
        continue;
      }

      where.push(attributePredicate(params, key, parseFlexibleValue(str)));
      appliedFilters[`attributes.${key}`] = str;
    }
  }

  const limit = Math.min(Math.max(parseMaybeNumber(query.limit) ?? 20, 1), 100);
  const offset = Math.max(parseMaybeNumber(query.offset) ?? 0, 0);
  const sort = parseSort(toSingleString(query.sort));

  return {
    whereSql: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
    params,
    sortSql: sort.sortSql,
    sortDirection: sort.direction,
    limit,
    offset,
    appliedFilters
  };
};

const attributeValueFromRow = (row: AttributeRow): ProductAttributeValue => {
  if (row.value_type === "number") {
    return Number(row.value_number ?? 0);
  }

  if (row.value_type === "boolean") {
    return Boolean(row.value_boolean);
  }

  return row.value_text ?? "";
};

const rowsToProducts = async (pool: Pool, rows: ProductRow[]): Promise<ProductResponse[]> => {
  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => row.id);
  const [attributesResult, tagsResult, reviewsResult] = await Promise.all([
    pool.query<AttributeRow>(
      `
        SELECT product_id, attr_key, value_type, value_text, value_number, value_boolean
        FROM product_attributes
        WHERE product_id = ANY($1::uuid[])
        ORDER BY attr_key ASC
      `,
      [ids]
    ),
    pool.query<TagRow>(
      `
        SELECT product_id, tag
        FROM product_tags
        WHERE product_id = ANY($1::uuid[])
        ORDER BY tag ASC
      `,
      [ids]
    ),
    pool.query<ReviewRow>(
      `
        SELECT product_id, user_name, rating, comment, date
        FROM reviews
        WHERE product_id = ANY($1::uuid[])
        ORDER BY date DESC
      `,
      [ids]
    )
  ]);

  const attributesByProduct = new Map<string, Record<string, ProductAttributeValue>>();
  for (const row of attributesResult.rows) {
    const attributes = attributesByProduct.get(row.product_id) ?? {};
    attributes[row.attr_key] = attributeValueFromRow(row);
    attributesByProduct.set(row.product_id, attributes);
  }

  const tagsByProduct = new Map<string, string[]>();
  for (const row of tagsResult.rows) {
    const tags = tagsByProduct.get(row.product_id) ?? [];
    tags.push(row.tag);
    tagsByProduct.set(row.product_id, tags);
  }

  const reviewsByProduct = new Map<string, ProductResponse["reviews"]>();
  for (const row of reviewsResult.rows) {
    const reviews = reviewsByProduct.get(row.product_id) ?? [];
    reviews.push({
      user: row.user_name,
      rating: row.rating,
      comment: row.comment,
      date: new Date(row.date).toISOString()
    });
    reviewsByProduct.set(row.product_id, reviews);
  }

  return rows.map((row) => ({
    _id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    stock: row.stock,
    attributes: attributesByProduct.get(row.id) ?? {},
    reviews: reviewsByProduct.get(row.id) ?? [],
    tags: tagsByProduct.get(row.id) ?? [],
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString()
  }));
};

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

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "23505";

export const listProducts = async (
  query: Record<string, unknown>
): Promise<ProductListResponse> => {
  const pool = getPostgresPool();
  const options = parseListOptions(query);

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM products p ${options.whereSql}`,
    options.params
  );

  const limitParam = addParam(options.params, options.limit);
  const offsetParam = addParam(options.params, options.offset);
  const productsResult = await pool.query<ProductRow>(
    `
      SELECT id, sku, name, description, price, category, stock, created_at, updated_at
      FROM products p
      ${options.whereSql}
      ORDER BY ${options.sortSql} ${options.sortDirection}, p.id ASC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `,
    options.params
  );

  const total = Number(countResult.rows[0]?.total ?? 0);

  return {
    data: await rowsToProducts(pool, productsResult.rows),
    pagination: {
      limit: options.limit,
      offset: options.offset,
      total,
      has_next: options.offset + options.limit < total
    },
    meta: {
      query_filters: options.appliedFilters
    }
  };
};

export const createProduct = async (input: {
  sku: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  attributes: Record<string, ProductAttributeValue>;
  tags: string[];
}): Promise<ProductResponse> => {
  const pool = getPostgresPool();
  const client = await pool.connect();
  const now = new Date();
  const productId = randomUUID();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO products (id, sku, name, description, price, category, stock, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [productId, input.sku, input.name, input.description, input.price, input.category, input.stock, now, now]
    );

    for (const [key, value] of Object.entries(input.attributes)) {
      await insertAttribute(client, productId, key, value);
    }

    for (const tag of input.tags) {
      await client.query("INSERT INTO product_tags (product_id, tag) VALUES ($1, $2)", [productId, tag]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    if (isUniqueViolation(error)) {
      throw new HttpError(409, "SKU_ALREADY_EXISTS", "Product with this SKU already exists");
    }

    throw error;
  } finally {
    client.release();
  }

  return getProductById(productId);
};

export const getProductById = async (id: string): Promise<ProductResponse> => {
  if (!uuidPattern.test(id)) {
    throw new HttpError(400, "INVALID_PRODUCT_ID", "Product id is not a valid UUID");
  }

  const pool = getPostgresPool();
  const result = await pool.query<ProductRow>(
    `
      SELECT id, sku, name, description, price, category, stock, created_at, updated_at
      FROM products
      WHERE id = $1
    `,
    [id]
  );

  if (result.rows.length === 0) {
    throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  const [product] = await rowsToProducts(pool, result.rows);
  return product;
};

export const addProductReview = async (
  id: string,
  review: Omit<ReviewDoc, "date"> & { date?: Date }
): Promise<ProductResponse> => {
  if (!uuidPattern.test(id)) {
    throw new HttpError(400, "INVALID_PRODUCT_ID", "Product id is not a valid UUID");
  }

  const pool = getPostgresPool();
  const result = await pool.query<{ id: string }>("SELECT id FROM products WHERE id = $1", [id]);
  if (result.rows.length === 0) {
    throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  await pool.query(
    `
      INSERT INTO reviews (id, product_id, user_name, rating, comment, date)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [randomUUID(), id, review.user, review.rating, review.comment, review.date ?? new Date()]
  );

  await pool.query("UPDATE products SET updated_at = $1 WHERE id = $2", [new Date(), id]);

  return getProductById(id);
};

export const getCategories = async (): Promise<string[]> => {
  const pool = getPostgresPool();
  const result = await pool.query<{ category: string }>(
    "SELECT DISTINCT category FROM products ORDER BY category ASC"
  );

  return result.rows.map((row) => row.category);
};

export const getAnalytics = async (): Promise<{
  timestamp: string;
  categories: Array<{
    category: string;
    count: number;
    avg_price: number;
    avg_rating: number | null;
  }>;
  summary: {
    total_products: number;
    total_categories: number;
    overall_avg_price: number;
    products_with_reviews: number;
  };
  top_products: Array<{
    _id: string;
    name: string;
    category: string;
    avg_rating: number;
    review_count: number;
    price: number;
  }>;
}> => {
  const pool = getPostgresPool();

  const [categoriesResult, summaryResult, topProductsResult] = await Promise.all([
    pool.query<{
      category: string;
      count: string;
      avg_price: string | null;
      avg_rating: string | null;
    }>(`
      WITH product_ratings AS (
        SELECT product_id, AVG(rating)::numeric AS avg_rating
        FROM reviews
        GROUP BY product_id
      )
      SELECT
        p.category,
        COUNT(*) AS count,
        ROUND(AVG(p.price), 2) AS avg_price,
        ROUND(AVG(product_ratings.avg_rating), 2) AS avg_rating
      FROM products p
      LEFT JOIN product_ratings ON product_ratings.product_id = p.id
      GROUP BY p.category
      ORDER BY COUNT(*) DESC
    `),
    pool.query<{
      total_products: string;
      total_categories: string;
      overall_avg_price: string | null;
      products_with_reviews: string;
    }>(`
      SELECT
        COUNT(*) AS total_products,
        COUNT(DISTINCT category) AS total_categories,
        ROUND(AVG(price), 2) AS overall_avg_price,
        COUNT(*) FILTER (
          WHERE EXISTS (SELECT 1 FROM reviews r WHERE r.product_id = products.id)
        ) AS products_with_reviews
      FROM products
    `),
    pool.query<{
      id: string;
      name: string;
      category: string;
      avg_rating: string;
      review_count: string;
      price: string;
    }>(`
      SELECT
        p.id,
        p.name,
        p.category,
        ROUND(AVG(r.rating), 2) AS avg_rating,
        COUNT(r.id) AS review_count,
        p.price
      FROM products p
      JOIN reviews r ON r.product_id = p.id
      GROUP BY p.id
      ORDER BY AVG(r.rating) DESC, COUNT(r.id) DESC
      LIMIT 5
    `)
  ]);

  const summary = summaryResult.rows[0];

  return {
    timestamp: new Date().toISOString(),
    categories: categoriesResult.rows.map((row) => ({
      category: row.category,
      count: Number(row.count),
      avg_price: Number(row.avg_price ?? 0),
      avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null
    })),
    summary: {
      total_products: Number(summary?.total_products ?? 0),
      total_categories: Number(summary?.total_categories ?? 0),
      overall_avg_price: Number(summary?.overall_avg_price ?? 0),
      products_with_reviews: Number(summary?.products_with_reviews ?? 0)
    },
    top_products: topProductsResult.rows.map((row) => ({
      _id: row.id,
      name: row.name,
      category: row.category,
      avg_rating: Number(row.avg_rating),
      review_count: Number(row.review_count),
      price: Number(row.price)
    }))
  };
};