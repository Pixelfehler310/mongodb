import { create } from "zustand";

type FilterState = {
  category: string;
  search: string;
  priceMin: string;
  priceMax: string;
  inStock: boolean;
  sort: string;
  offset: number;
  limit: number;
  attributes: Record<string, string>;
  setCategory: (category: string) => void;
  setSearch: (search: string) => void;
  setPriceMin: (value: string) => void;
  setPriceMax: (value: string) => void;
  setInStock: (value: boolean) => void;
  setSort: (value: string) => void;
  setOffset: (value: number) => void;
  setLimit: (value: number) => void;
  setAttribute: (key: string, value: string) => void;
  clearAttributes: () => void;
  reset: () => void;
};

const initialState = {
  category: "",
  search: "",
  priceMin: "",
  priceMax: "",
  inStock: false,
  sort: "-created_at",
  offset: 0,
  limit: 20,
  attributes: {}
};

export const useFilterStore = create<FilterState>((set) => ({
  ...initialState,
  setCategory: (category) => set({ category, offset: 0 }),
  setSearch: (search) => set({ search, offset: 0 }),
  setPriceMin: (priceMin) => set({ priceMin, offset: 0 }),
  setPriceMax: (priceMax) => set({ priceMax, offset: 0 }),
  setInStock: (inStock) => set({ inStock, offset: 0 }),
  setSort: (sort) => set({ sort, offset: 0 }),
  setOffset: (offset) => set({ offset }),
  setLimit: (limit) => set({ limit, offset: 0 }),
  setAttribute: (key, value) =>
    set((state) => ({
      attributes: {
        ...state.attributes,
        [key]: value
      },
      offset: 0
    })),
  clearAttributes: () => set({ attributes: {}, offset: 0 }),
  reset: () => set(initialState)
}));
