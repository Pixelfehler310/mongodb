import {
  MongoServerError,
  ObjectId,
  type Document,
  type Sort
} from "mongodb";
import { getDb } from "../db/mongo.js";
import type {
  ProductAttributeValue,
  ProductDoc,
  ProductListResponse,
  ProductResponse,
  ReviewDoc
} from "../types/domain.js";
import { HttpError } from "../utils/http-error.js";

type ParsedListOptions = {
  match: Document;
  sort: Sort;
  limit: number;
  offset: number;
  appliedFilters: Record<string, unknown>;
};

const productsCollection = () => getDb().collection<ProductDoc>("products");

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

const parseFlexibleValue = (value: string): string | number | boolean => {
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
    const first = value.find((item): item is string => typeof item === "string");
    return first;
  }

  return undefined;
};

const parseSort = (value: string | undefined): Sort => {
  if (!value) {
    return { created_at: -1 };
  }

  const normalized = value.trim();
  const isDesc = normalized.startsWith("-");
  const field = isDesc ? normalized.slice(1) : normalized;

  const allowedFields = new Set([
    "name",
    "price",
    "stock",
    "category",
    "created_at",
    "updated_at"
  ]);

  if (!allowedFields.has(field)) {
    throw new HttpError(400, "INVALID_SORT_FIELD", `Unsupported sort field: ${field}`);
  }

  return { [field]: isDesc ? -1 : 1 };
};

const serializeProduct = (doc: ProductDoc): ProductResponse => ({
  _id: String(doc._id),
  sku: doc.sku,
  name: doc.name,
  description: doc.description,
  price: doc.price,
  category: doc.category,
  stock: doc.stock,
  attributes: doc.attributes,
  reviews: (doc.reviews ?? []).map((review) => ({
    user: review.user,
    rating: review.rating,
    comment: review.comment,
    date: new Date(review.date).toISOString()
  })),
  tags: doc.tags ?? [],
  created_at: new Date(doc.created_at).toISOString(),
  updated_at: new Date(doc.updated_at).toISOString()
});

const parseListOptions = (query: Record<string, unknown>): ParsedListOptions => {
  const match: Document = {};
  const appliedFilters: Record<string, unknown> = {};

  const category = toSingleString(query.category);
  if (category) {
    match.category = category;
    appliedFilters.category = category;
  }

  const search = toSingleString(query.search);
  if (search) {
    match.$text = { $search: search };
    appliedFilters.search = search;
  }

  const priceGt = parseMaybeNumber(query.price_gt);
  const priceGte = parseMaybeNumber(query.price_gte);
  const priceLt = parseMaybeNumber(query.price_lt);
  const priceLte = parseMaybeNumber(query.price_lte);

  const priceFilter: Record<string, number> = {};
  if (priceGt !== undefined) {
    priceFilter.$gt = priceGt;
  }
  if (priceGte !== undefined) {
    priceFilter.$gte = priceGte;
  }
  if (priceLt !== undefined) {
    priceFilter.$lt = priceLt;
  }
  if (priceLte !== undefined) {
    priceFilter.$lte = priceLte;
  }

  if (Object.keys(priceFilter).length > 0) {
    match.price = priceFilter;
    appliedFilters.price = priceFilter;
  }

  const inStock = toSingleString(query.in_stock);
  if (inStock && ["true", "false"].includes(inStock.toLowerCase())) {
    const enabled = inStock.toLowerCase() === "true";
    match.stock = enabled ? { $gt: 0 } : { $lte: 0 };
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
        match[`attributes.${attrKey}`] = parseFlexibleValue(str);
        appliedFilters[key] = str;
      }
    }

    const bracket = key.match(/^attributes\[(.+)\]$/);
    if (bracket?.[1]) {
      const attrKey = bracket[1];
      match[`attributes.${attrKey}`] = parseFlexibleValue(str);
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

      match[`attributes.${key}`] = parseFlexibleValue(str);
      appliedFilters[`attributes.${key}`] = str;
    }
  }

  const limit = Math.min(Math.max(parseMaybeNumber(query.limit) ?? 20, 1), 100);
  const offset = Math.max(parseMaybeNumber(query.offset) ?? 0, 0);

  const sort = parseSort(toSingleString(query.sort));

  return {
    match,
    sort,
    limit,
    offset,
    appliedFilters
  };
};

export const listProducts = async (
  query: Record<string, unknown>
): Promise<ProductListResponse> => {
  const options = parseListOptions(query);
  const collection = productsCollection();

  const total = await collection.countDocuments(options.match);
  const docs = await collection
    .find(options.match)
    .sort(options.sort)
    .skip(options.offset)
    .limit(options.limit)
    .toArray();

  return {
    data: docs.map(serializeProduct),
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
  const now = new Date();
  const doc: Omit<ProductDoc, "_id"> = {
    sku: input.sku,
    name: input.name,
    description: input.description,
    price: input.price,
    category: input.category,
    stock: input.stock,
    attributes: input.attributes,
    reviews: [],
    tags: input.tags,
    created_at: now,
    updated_at: now
  };

  let insertedId: ObjectId;
  try {
    const insertResult = await getDb().collection<Omit<ProductDoc, "_id">>("products").insertOne(doc);
    insertedId = insertResult.insertedId;
  } catch (error) {
    if (
      error instanceof MongoServerError &&
      error.code === 11000 &&
      String(error.message).includes("sku")
    ) {
      throw new HttpError(409, "SKU_ALREADY_EXISTS", "Product with this SKU already exists");
    }

    throw error;
  }

  const created = await productsCollection().findOne({ _id: insertedId });
  if (!created) {
    throw new HttpError(500, "PRODUCT_CREATE_FAILED", "Product could not be loaded after creation");
  }

  return serializeProduct(created);
};

export const getProductById = async (id: string): Promise<ProductResponse> => {
  if (!ObjectId.isValid(id)) {
    throw new HttpError(400, "INVALID_PRODUCT_ID", "Product id is not a valid ObjectId");
  }

  const product = await productsCollection().findOne({ _id: new ObjectId(id) });
  if (!product) {
    throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  return serializeProduct(product);
};

export const addProductReview = async (
  id: string,
  review: Omit<ReviewDoc, "date"> & { date?: Date }
): Promise<ProductResponse> => {
  if (!ObjectId.isValid(id)) {
    throw new HttpError(400, "INVALID_PRODUCT_ID", "Product id is not a valid ObjectId");
  }

  const preparedReview: ReviewDoc = {
    user: review.user,
    rating: review.rating,
    comment: review.comment,
    date: review.date ?? new Date()
  };

  const updated = await productsCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $push: { reviews: preparedReview },
      $set: { updated_at: new Date() }
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  return serializeProduct(updated);
};

export const getCategories = async (): Promise<string[]> => {
  const categories = await productsCollection().distinct("category");
  return categories.sort((a, b) => a.localeCompare(b));
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
  const collection = productsCollection();

  const categories = await collection
    .aggregate<{
      _id: string;
      count: number;
      avg_price: number;
      avg_rating: number | null;
    }>([
      {
        $addFields: {
          avg_rating_local: {
            $cond: [
              { $gt: [{ $size: "$reviews" }, 0] },
              { $avg: "$reviews.rating" },
              null
            ]
          }
        }
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          avg_price: { $avg: "$price" },
          avg_rating: { $avg: "$avg_rating_local" }
        }
      },
      { $sort: { count: -1 } }
    ])
    .toArray();

  const topProducts = await collection
    .aggregate<{
      _id: string;
      name: string;
      category: string;
      avg_rating: number;
      review_count: number;
      price: number;
    }>([
      {
        $addFields: {
          avg_rating: {
            $cond: [
              { $gt: [{ $size: "$reviews" }, 0] },
              { $avg: "$reviews.rating" },
              0
            ]
          },
          review_count: { $size: "$reviews" }
        }
      },
      { $match: { review_count: { $gt: 0 } } },
      { $sort: { avg_rating: -1, review_count: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: { $toString: "$_id" },
          name: 1,
          category: 1,
          avg_rating: { $round: ["$avg_rating", 2] },
          review_count: 1,
          price: 1
        }
      }
    ])
    .toArray();

  const [totalProducts, overallPriceAggregate, productsWithReviews] = await Promise.all([
    collection.countDocuments({}),
    collection
      .aggregate<{ value: number }>([
        { $group: { _id: null, value: { $avg: "$price" } } },
        { $project: { _id: 0, value: { $round: ["$value", 2] } } }
      ])
      .toArray(),
    collection.countDocuments({ "reviews.0": { $exists: true } })
  ]);

  return {
    timestamp: new Date().toISOString(),
    categories: categories.map((item) => ({
      category: item._id,
      count: item.count,
      avg_price: Number(item.avg_price.toFixed(2)),
      avg_rating: item.avg_rating !== null ? Number(item.avg_rating.toFixed(2)) : null
    })),
    summary: {
      total_products: totalProducts,
      total_categories: categories.length,
      overall_avg_price: overallPriceAggregate[0]?.value ?? 0,
      products_with_reviews: productsWithReviews
    },
    top_products: topProducts
  };
};
