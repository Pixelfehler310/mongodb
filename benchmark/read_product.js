import http from "k6/http";
import { check } from "k6";
import { benchmarkConfig, buildDbPath, buildTwoPhaseOptions, recordMeasuredResponse, requestParams } from "./lib/config.js";

export const options = buildTwoPhaseOptions();

const buildTags = (phase) => ({
  scenario: "read-product",
  db_mode: benchmarkConfig.dbMode,
  phase,
});

export const setup = () => {
  const response = http.get(
    `${benchmarkConfig.baseUrl}${buildDbPath("/products?limit=1&sort=-created_at")}`,
    requestParams(buildTags("setup")),
  );

  const ok = check(response, {
    "setup returned 200": (candidate) => candidate.status === 200,
  });

  if (!ok) {
    throw new Error(`Failed to fetch a product id for ${benchmarkConfig.dbMode}`);
  }

  const payload = JSON.parse(response.body || "{}");
  const data = Array.isArray(payload.data) ? payload.data : [];
  const firstProduct = data.length > 0 ? data[0] : null;
  const productId = firstProduct ? firstProduct._id : null;
  if (!productId) {
    throw new Error(`Seed data missing for ${benchmarkConfig.dbMode}; run seeding before benchmarks`);
  }

  return { productId };
};

const runRequest = (data, shouldRecord) => {
  const response = http.get(
    `${benchmarkConfig.baseUrl}${buildDbPath(`/products/${data.productId}`)}`,
    requestParams(buildTags(shouldRecord ? "measure" : "warmup")),
  );

  const checksPassed = check(response, {
    "product details returned 200": (candidate) => candidate.status === 200,
    "product details payload has id": (candidate) => Boolean(JSON.parse(candidate.body || "{}")._id),
  });

  if (shouldRecord) {
    recordMeasuredResponse(response, checksPassed, buildTags("measure"));
  }
};

export const warmup = (data) => {
  runRequest(data, false);
};

export const measure = (data) => {
  runRequest(data, true);
};