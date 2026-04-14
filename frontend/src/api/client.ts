import type {
  AnalyticsPayload,
  CategoriesPayload,
  ProductListPayload,
  Product,
  ReviewPayload
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

type ProductFilterInput = {
  category?: string;
  search?: string;
  price_gte?: number;
  price_lte?: number;
  in_stock?: boolean;
  sort?: string;
  limit?: number;
  offset?: number;
  attributes?: Record<string, string>;
};

const toQueryString = (filters: ProductFilterInput): string => {
  const params = new URLSearchParams();

  if (filters.category) params.set("category", filters.category);
  if (filters.search) params.set("search", filters.search);
  if (typeof filters.price_gte === "number") params.set("price_gte", String(filters.price_gte));
  if (typeof filters.price_lte === "number") params.set("price_lte", String(filters.price_lte));
  if (typeof filters.in_stock === "boolean") params.set("in_stock", String(filters.in_stock));
  if (filters.sort) params.set("sort", filters.sort);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters.offset === "number") params.set("offset", String(filters.offset));

  if (filters.attributes) {
    for (const [key, value] of Object.entries(filters.attributes)) {
      if (value.trim() !== "") {
        params.set(`attributes.${key}`, value);
      }
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message ?? "API request failed";
    throw new Error(message);
  }

  return payload as T;
};

export const apiClient = {
  listProducts: (filters: ProductFilterInput) =>
    request<ProductListPayload>(`/products${toQueryString(filters)}`),

  getProduct: (id: string) => request<Product>(`/products/${id}`),

  addReview: (id: string, body: { user: string; rating: number; comment: string }) =>
    request<ReviewPayload>(`/products/${id}/reviews`, {
      method: "POST",
      body: JSON.stringify(body)
    }),

  getCategories: () => request<CategoriesPayload>("/categories"),

  getAnalytics: () => request<AnalyticsPayload>("/analytics"),

  seedData: (count = 120) =>
    request<{ success: boolean; inserted_count: number; cleared: boolean }>("/seed", {
      method: "POST",
      body: JSON.stringify({ count, clear_existing: true })
    })
};
