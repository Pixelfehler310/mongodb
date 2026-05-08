import http from "k6/http";
import { check } from "k6";
import { benchmarkConfig, buildSingleRunOptions, recordMeasuredResponse, requestParams } from "./lib/config.js";

export const options = buildSingleRunOptions("30m");

const buildTags = () => ({
  scenario: "bulk-insert",
  db_mode: benchmarkConfig.dbMode,
  phase: "measure",
});

export const measure = () => {
  const response = http.post(
    `${benchmarkConfig.baseUrl}/seed?db=${benchmarkConfig.dbMode}`,
    JSON.stringify({
      count: benchmarkConfig.seedCount,
      clear_existing: true,
    }),
    {
      timeout: benchmarkConfig.timeout,
      tags: buildTags(),
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const checksPassed = check(response, {
    "bulk insert returned 200": (candidate) => candidate.status === 200,
    "bulk insert inserted requested rows": (candidate) => {
      const payload = JSON.parse(candidate.body || "{}");
      return Number(payload.inserted_count) >= benchmarkConfig.seedCount;
    },
  });

  recordMeasuredResponse(response, checksPassed, buildTags());
};