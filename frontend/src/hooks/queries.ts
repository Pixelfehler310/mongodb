import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useFilterStore } from "../store/filters";

export const useProductsQuery = () => {
  const filters = useFilterStore();

  return useQuery({
    queryKey: ["products", filters.category, filters.search, filters.priceMin, filters.priceMax, filters.inStock, filters.sort, filters.offset, filters.limit, filters.attributes],
    queryFn: () =>
      apiClient.listProducts({
        category: filters.category || undefined,
        search: filters.search || undefined,
        price_gte: filters.priceMin ? Number(filters.priceMin) : undefined,
        price_lte: filters.priceMax ? Number(filters.priceMax) : undefined,
        in_stock: filters.inStock,
        sort: filters.sort,
        offset: filters.offset,
        limit: filters.limit,
        attributes: filters.attributes
      })
  });
};

export const useCategoriesQuery = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.getCategories(),
    staleTime: 5 * 60 * 1000
  });
};

export const useProductDetailQuery = (id: string) => {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => apiClient.getProduct(id),
    enabled: Boolean(id)
  });
};

export const useAnalyticsQuery = () => {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiClient.getAnalytics(),
    staleTime: 30 * 1000
  });
};

export const useAddReviewMutation = (productId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { user: string; rating: number; comment: string }) =>
      apiClient.addReview(productId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    }
  });
};

export const useSeedMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (count?: number) => apiClient.seedData(count ?? 120),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    }
  });
};
