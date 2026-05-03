import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useDatabaseStore } from "../store/database";
import { useFilterStore } from "../store/filters";
import type { CreateProductInput } from "../types";

export const useProductsQuery = () => {
  const filters = useFilterStore();
  const dbMode = useDatabaseStore((state) => state.mode);

  return useQuery({
    queryKey: ["products", dbMode, filters.category, filters.search, filters.priceMin, filters.priceMax, filters.inStock, filters.sort, filters.offset, filters.limit, filters.attributes],
    queryFn: () =>
      apiClient.listProducts({
        db: dbMode,
        category: filters.category || undefined,
        search: filters.search || undefined,
        price_gte: filters.priceMin ? Number(filters.priceMin) : undefined,
        price_lte: filters.priceMax ? Number(filters.priceMax) : undefined,
        in_stock: filters.inStock ? true : undefined,
        sort: filters.sort,
        offset: filters.offset,
        limit: filters.limit,
        attributes: filters.attributes
      })
  });
};

export const useCategoriesQuery = () => {
  const dbMode = useDatabaseStore((state) => state.mode);

  return useQuery({
    queryKey: ["categories", dbMode],
    queryFn: () => apiClient.getCategories(dbMode),
    staleTime: 5 * 60 * 1000
  });
};

export const useProductDetailQuery = (id: string) => {
  const dbMode = useDatabaseStore((state) => state.mode);

  return useQuery({
    queryKey: ["product", dbMode, id],
    queryFn: () => apiClient.getProduct(id, dbMode),
    enabled: Boolean(id)
  });
};

export const useAnalyticsQuery = () => {
  const dbMode = useDatabaseStore((state) => state.mode);

  return useQuery({
    queryKey: ["analytics", dbMode],
    queryFn: () => apiClient.getAnalytics(dbMode),
    staleTime: 30 * 1000
  });
};

export const useHealthQuery = () => {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 10 * 1000
  });
};

export const useAddReviewMutation = (productId: string) => {
  const queryClient = useQueryClient();
  const dbMode = useDatabaseStore((state) => state.mode);

  return useMutation({
    mutationFn: (body: { user: string; rating: number; comment: string }) =>
      apiClient.addReview(productId, dbMode, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product", dbMode, productId] });
      await queryClient.invalidateQueries({ queryKey: ["analytics", dbMode] });
    }
  });
};

export const useSeedMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (count?: number) => apiClient.seedData(count ?? 120, "both"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    }
  });
};

export const useCreateProductMutation = () => {
  const queryClient = useQueryClient();
  const dbMode = useDatabaseStore((state) => state.mode);

  return useMutation({
    mutationFn: (body: CreateProductInput) => apiClient.createProduct(dbMode, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    }
  });
};
