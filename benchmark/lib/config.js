import { Counter, Rate, Trend } from "k6/metrics";

const withFallback = (rawValue, fallback) => (rawValue === undefined || rawValue === null || rawValue === "" ? fallback : rawValue);

const parsePositiveInteger = (rawValue, fallback) => {
  const parsed = Number(withFallback(rawValue, fallback));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const benchmarkConfig = {
  baseUrl: withFallback(__ENV.K6_API_BASE_URL, "http://backend:3000/api/v1"),
  dbMode: String(withFallback(__ENV.K6_DB_MODE, "mongo")).toLowerCase(),
  vus: parsePositiveInteger(__ENV.K6_VUS, 20),
  warmupSeconds: parsePositiveInteger(__ENV.K6_WARMUP_SECONDS, 30),
  measureSeconds: parsePositiveInteger(__ENV.K6_DURATION_SECONDS, 60),
  seedCount: parsePositiveInteger(__ENV.K6_SEED_COUNT, 10000),
  timeout: withFallback(__ENV.K6_TIMEOUT, "120s"),
};

export const benchmarkRequestDuration = new Trend("benchmark_http_req_duration_ms", true);
export const benchmarkRequestCount = new Counter("benchmark_http_reqs");
export const benchmarkFailedRate = new Rate("benchmark_http_req_failed");
export const benchmarkCheckRate = new Rate("benchmark_checks");

const commonSummaryTrendStats = ["avg", "min", "med", "max", "p(95)", "p(99)"];

export const buildDbPath = (path) => `${path}${path.includes("?") ? "&" : "?"}db=${benchmarkConfig.dbMode}`;

export const buildTwoPhaseOptions = () => ({
  summaryTrendStats: commonSummaryTrendStats,
  scenarios: {
    warmup: {
      executor: "constant-vus",
      exec: "warmup",
      vus: benchmarkConfig.vus,
      duration: `${benchmarkConfig.warmupSeconds}s`,
      gracefulStop: "0s",
    },
    measure: {
      executor: "constant-vus",
      exec: "measure",
      vus: benchmarkConfig.vus,
      duration: `${benchmarkConfig.measureSeconds}s`,
      startTime: `${benchmarkConfig.warmupSeconds}s`,
      gracefulStop: "0s",
    },
  },
});

export const buildSingleRunOptions = (maxDuration = "30m") => ({
  summaryTrendStats: commonSummaryTrendStats,
  scenarios: {
    measure: {
      executor: "per-vu-iterations",
      exec: "measure",
      vus: 1,
      iterations: 1,
      maxDuration,
    },
  },
});

export const requestParams = (tags) => ({
  timeout: benchmarkConfig.timeout,
  tags,
});

export const recordMeasuredResponse = (response, checksPassed, tags = {}) => {
  benchmarkRequestDuration.add(response.timings.duration, tags);
  benchmarkRequestCount.add(1, tags);
  benchmarkFailedRate.add(!response || !response.status || response.status >= 400, tags);
  benchmarkCheckRate.add(Boolean(checksPassed), tags);
};