import http from "k6/http";
import { check } from "k6";
import { benchmarkConfig, buildDbPath, buildTwoPhaseOptions, recordMeasuredResponse, requestParams } from "./lib/config.js";

export const options = buildTwoPhaseOptions();

const path = buildDbPath("/products?limit=20&category=Electronics&attributes.ram_gb=16&search=showcase&in_stock=true&sort=-created_at");
const buildTags = (phase) => ({
  scenario: "catalog-search",
  db_mode: benchmarkConfig.dbMode,
  phase,
});

const runRequest = (shouldRecord) => {
  const response = http.get(
    `${benchmarkConfig.baseUrl}${path}`,
    requestParams(buildTags(shouldRecord ? "measure" : "warmup")),
  );

  const checksPassed = check(response, {
    "catalog search returned 200": (candidate) => candidate.status === 200,
    "catalog search payload has data": (candidate) => Array.isArray(JSON.parse(candidate.body || "{}").data),
  });

  if (shouldRecord) {
    recordMeasuredResponse(response, checksPassed, buildTags("measure"));
  }
};

export const warmup = () => {
  runRequest(false);
};

export const measure = () => {
  runRequest(true);
};