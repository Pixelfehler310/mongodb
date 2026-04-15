export type Review = {
  user: string;
  rating: number;
  comment: string;
  date: string;
};

export type Product = {
  _id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  attributes: Record<string, string | number | boolean>;
  reviews: Review[];
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type ProductListPayload = {
  data: Product[];
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

export type CategoriesPayload = {
  data: string[];
  count: number;
};

export type AnalyticsPayload = {
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
};

export type ReviewPayload = {
  success: boolean;
  message: string;
  product: Product;
};

export type HealthPayload = {
  status: "ok" | "degraded";
  dependencies: {
    mongodb: "connected" | "disconnected";
  };
  timestamp: string;
};
