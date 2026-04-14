import type { ObjectId } from "mongodb";

export type ProductAttributeValue = string | number | boolean;

export type ProductDoc = {
  _id: ObjectId;
  sku: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  attributes: Record<string, ProductAttributeValue>;
  reviews: ReviewDoc[];
  tags: string[];
  created_at: Date;
  updated_at: Date;
};

export type ReviewDoc = {
  user: string;
  rating: number;
  comment: string;
  date: Date;
};

export type ProductResponse = {
  _id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  attributes: Record<string, ProductAttributeValue>;
  reviews: Array<Omit<ReviewDoc, "date"> & { date: string }>;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type ProductListResponse = {
  data: ProductResponse[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_next: boolean;
  };
  meta: {
    query_filters: Record<string, unknown>;
  };
};
