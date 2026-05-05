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

export type CreateProductInput = {
  sku: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  attributes: Record<string, string | number | boolean>;
  tags: string[];
};

export type CreateProductPayload = {
  success: boolean;
  message: string;
  product: Product;
};

export type HealthPayload = {
  status: "ok" | "degraded";
  dependencies: {
    mongodb: "connected" | "disconnected";
    postgresql: "connected" | "disconnected";
  };
  timestamp: string;
};

export type PerformanceScenarioPreset = {
  id: string;
  name: string;
  description: string;
  path: string;
  method: "GET" | "POST";
  supportsDbMode: boolean;
  tags: string[];
};

export type PerformancePresetsPayload = {
  available_db_modes: Array<"mongo" | "postgres">;
  defaults: {
    duration_seconds: number;
    concurrency: number;
    iterations: number;
    db_modes: Array<"mongo" | "postgres">;
    scenario_ids: string[];
  };
  scenarios: PerformanceScenarioPreset[];
  timestamp: string;
};

export type PerformanceRunResult = {
  run_id: string;
  label: string;
  scenario_id: string;
  scenario_name: string;
  db_mode: "mongo" | "postgres";
  iteration: number;
  path: string;
  url: string;
  method: string;
  duration_seconds: number;
  concurrency: number;
  requests: number;
  succeeded: number;
  failed: number;
  success_rate: number;
  requests_per_second: number;
  latency_ms: {
    min: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  status_counts: Record<string, number>;
  timeline: Array<{
    second: number;
    requests: number;
    succeeded: number;
    failed: number;
    avg_latency_ms: number;
    requests_per_second: number;
    success_rate: number;
  }>;
};

export type PerformanceRunPayload = {
  success: boolean;
  plan: {
    duration_seconds: number;
    concurrency: number;
    iterations: number;
    db_modes: Array<"mongo" | "postgres">;
    scenario_ids: string[];
    estimated_total_seconds: number;
  };
  started_at: string;
  completed_at: string;
  runs: PerformanceRunResult[];
  analytics: {
    totals: {
      total_runs: number;
      total_requests: number;
      total_succeeded: number;
      total_failed: number;
      avg_requests_per_second: number;
      avg_p95_latency_ms: number;
      avg_success_rate: number;
    };
    db_comparison: Array<{
      db_mode: "mongo" | "postgres";
      runs: number;
      total_requests: number;
      avg_requests_per_second: number;
      avg_p95_latency_ms: number;
      avg_success_rate: number;
      best_run_label: string;
    }>;
    scenario_comparison: Array<{
      scenario_id: string;
      scenario_name: string;
      db_mode: "mongo" | "postgres";
      runs: number;
      avg_requests_per_second: number;
      avg_p95_latency_ms: number;
      avg_success_rate: number;
    }>;
    db_trends: Array<{
      db_mode: "mongo" | "postgres";
      timeline: Array<{
        second: number;
        requests_per_second: number;
        avg_latency_ms: number;
        success_rate: number;
      }>;
    }>;
    highlights: {
      fastest_run_label: string | null;
      lowest_p95_run_label: string | null;
    };
  };
  timestamp: string;
};
