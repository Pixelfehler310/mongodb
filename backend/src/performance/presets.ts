import type { DatabaseMode } from "../db/database-mode.js";

export type PerformanceScenarioPreset = {
  id: string;
  name: string;
  description: string;
  path: string;
  method: "GET" | "POST";
  supportsDbMode: boolean;
  tags: string[];
};

export const performanceScenarioPresets: PerformanceScenarioPreset[] = [
  {
    id: "catalog-overview",
    name: "Catalog Overview",
    description: "Baseline product listing with pagination only.",
    path: "/products?limit=20",
    method: "GET",
    supportsDbMode: true,
    tags: ["listing", "baseline"],
  },
  {
    id: "category-filter",
    name: "Category Filter",
    description: "Category constrained list query for common browse traffic.",
    path: "/products?limit=20&category=Electronics",
    method: "GET",
    supportsDbMode: true,
    tags: ["listing", "filter"],
  },
  {
    id: "attribute-filter",
    name: "Attribute Filter",
    description: "Attribute lookup to compare flexible document search versus relational joins.",
    path: "/products?limit=20&attributes.ram_gb=16",
    method: "GET",
    supportsDbMode: true,
    tags: ["listing", "attributes"],
  },
  {
    id: "text-search",
    name: "Text Search",
    description: "Text search over indexed showcase fields.",
    path: "/products?limit=20&search=showcase",
    method: "GET",
    supportsDbMode: true,
    tags: ["search", "text"],
  },
  {
    id: "analytics-rollup",
    name: "Analytics Rollup",
    description: "Analytical aggregation endpoint for category and rating insights.",
    path: "/analytics",
    method: "GET",
    supportsDbMode: true,
    tags: ["analytics", "aggregation"],
  },
];

export const getPerformanceScenarioPreset = (scenarioId: string): PerformanceScenarioPreset | undefined => performanceScenarioPresets.find((scenario) => scenario.id === scenarioId);

export const getDefaultPerformanceDbModes = (availableDbModes: DatabaseMode[]): DatabaseMode[] => {
  if (availableDbModes.length === 0) {
    return [];
  }

  if (availableDbModes.includes("mongo") && availableDbModes.includes("postgres")) {
    return ["mongo", "postgres"];
  }

  return [availableDbModes[0]];
};

export const defaultPerformanceScenarioIds = ["catalog-overview", "text-search", "analytics-rollup"];
