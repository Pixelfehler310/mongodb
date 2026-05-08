import http from "k6/http";
import { check } from "k6";
import { benchmarkConfig, buildDbPath, buildTwoPhaseOptions, recordMeasuredResponse, requestParams } from "./lib/config.js";

export const options = buildTwoPhaseOptions();

const path = buildDbPath("/analytics");
const buildTags = (phase) => ({
  scenario: "analytics-rollup",
  db_mode: benchmarkConfig.dbMode,
  phase,
});

const runRequest = (shouldRecord) => {
  const response = http.get(
    `${benchmarkConfig.baseUrl}${path}`,
    requestParams(buildTags(shouldRecord ? "measure" : "warmup")),
  );

  const checksPassed = check(response, {
    "analytics returned 200": (candidate) => candidate.status === 200,
    "analytics payload has summary": (candidate) => Boolean(JSON.parse(candidate.body || "{}").summary),
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