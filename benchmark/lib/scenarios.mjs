export const scenarioDefinitions = {
  "read-product": {
    file: "read_product.js",
    label: "Read Product",
    type: "http",
  },
  "catalog-search": {
    file: "catalog_search.js",
    label: "Catalog Search",
    type: "http",
  },
  "analytics-rollup": {
    file: "analytics_rollup.js",
    label: "Analytics Rollup",
    type: "http",
  },
  "bulk-insert": {
    file: "bulk_insert.js",
    label: "Bulk Insert",
    type: "insert",
    timeout: "15m",
  },
};

export const defaultScenarioIds = ["read-product", "catalog-search", "analytics-rollup", "bulk-insert"];

export const parseScenarioIds = (rawValue) => {
  if (!rawValue || rawValue === "all") {
    return [...defaultScenarioIds];
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

export const parseDbModes = (rawValue) => {
  if (!rawValue || rawValue === "both") {
    return ["mongo", "postgres"];
  }

  return rawValue
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
};

export const validateScenarioIds = (scenarioIds) => {
  for (const scenarioId of scenarioIds) {
    if (!scenarioDefinitions[scenarioId]) {
      throw new Error(`Unknown scenario: ${scenarioId}`);
    }
  }
};

export const validateDbModes = (dbModes) => {
  for (const dbMode of dbModes) {
    if (dbMode !== "mongo" && dbMode !== "postgres") {
      throw new Error(`Unsupported db mode: ${dbMode}`);
    }
  }
};