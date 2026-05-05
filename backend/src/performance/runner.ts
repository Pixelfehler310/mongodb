import type { DatabaseMode } from "../db/database-mode.js";
import type { PerformanceScenarioPreset } from "./presets.js";

type Sample = {
  completedAtMs: number;
  durationMs: number;
  ok: boolean;
  status: number;
};

type TimelineBucket = {
  second: number;
  requests: number;
  succeeded: number;
  failed: number;
  avg_latency_ms: number;
  requests_per_second: number;
  success_rate: number;
};

export type PerformanceRunResult = {
  run_id: string;
  label: string;
  scenario_id: string;
  scenario_name: string;
  db_mode: DatabaseMode;
  iteration: number;
  path: string;
  url: string;
  method: string;
  duration_seconds: number;
  concurrency: number;
  requests: number;
  succeeded: number;
  failed: number;
  success_rate: number;
  requests_per_second: number;
  latency_ms: {
    min: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  status_counts: Record<string, number>;
  timeline: TimelineBucket[];
};

type TrendBucket = {
  second: number;
  requests_per_second: number;
  avg_latency_ms: number;
  success_rate: number;
};

export type PerformanceAnalytics = {
  totals: {
    total_runs: number;
    total_requests: number;
    total_succeeded: number;
    total_failed: number;
    avg_requests_per_second: number;
    avg_p95_latency_ms: number;
    avg_success_rate: number;
  };
  db_comparison: Array<{
    db_mode: DatabaseMode;
    runs: number;
    total_requests: number;
    avg_requests_per_second: number;
    avg_p95_latency_ms: number;
    avg_success_rate: number;
    best_run_label: string;
  }>;
  scenario_comparison: Array<{
    scenario_id: string;
    scenario_name: string;
    db_mode: DatabaseMode;
    runs: number;
    avg_requests_per_second: number;
    avg_p95_latency_ms: number;
    avg_success_rate: number;
  }>;
  db_trends: Array<{
    db_mode: DatabaseMode;
    timeline: TrendBucket[];
  }>;
  highlights: {
    fastest_run_label: string | null;
    lowest_p95_run_label: string | null;
  };
};

export type PerformanceSuiteResult = {
  started_at: string;
  completed_at: string;
  runs: PerformanceRunResult[];
  analytics: PerformanceAnalytics;
};

type RunPerformanceScenarioOptions = {
  baseUrl: string;
  scenario: PerformanceScenarioPreset;
  dbMode: DatabaseMode;
  iteration: number;
  durationSeconds: number;
  concurrency: number;
};

type RunPerformanceSuiteOptions = {
  baseUrl: string;
  scenarios: PerformanceScenarioPreset[];
  dbModes: DatabaseMode[];
  iterations: number;
  durationSeconds: number;
  concurrency: number;
};

const percentile = (sorted: number[], fraction: number): number => {
  if (sorted.length === 0) {
    return 0;
  }

  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
};

const buildUrl = (baseUrl: string, scenario: PerformanceScenarioPreset, dbMode: DatabaseMode): string => {
  const url = `${baseUrl}${scenario.path}`;

  if (!scenario.supportsDbMode) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}db=${dbMode}`;
};

const toFixedNumber = (value: number): number => Number(value.toFixed(2));

const buildTimeline = (samples: Sample[]): TimelineBucket[] => {
  const buckets = new Map<number, { requests: number; succeeded: number; failed: number; latencyTotal: number }>();

  for (const sample of samples) {
    const second = Math.max(1, Math.ceil(sample.completedAtMs / 1000));
    const existing = buckets.get(second) ?? {
      requests: 0,
      succeeded: 0,
      failed: 0,
      latencyTotal: 0,
    };

    existing.requests += 1;
    existing.succeeded += sample.ok ? 1 : 0;
    existing.failed += sample.ok ? 0 : 1;
    existing.latencyTotal += sample.durationMs;
    buckets.set(second, existing);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([second, bucket]) => ({
      second,
      requests: bucket.requests,
      succeeded: bucket.succeeded,
      failed: bucket.failed,
      avg_latency_ms: toFixedNumber(bucket.latencyTotal / Math.max(bucket.requests, 1)),
      requests_per_second: toFixedNumber(bucket.requests),
      success_rate: toFixedNumber((bucket.succeeded / Math.max(bucket.requests, 1)) * 100),
    }));
};

const summarizeRuns = (runs: PerformanceRunResult[]): PerformanceAnalytics => {
  const totalRequests = runs.reduce((sum, run) => sum + run.requests, 0);
  const totalSucceeded = runs.reduce((sum, run) => sum + run.succeeded, 0);
  const totalFailed = runs.reduce((sum, run) => sum + run.failed, 0);
  const avgRequestsPerSecond = runs.reduce((sum, run) => sum + run.requests_per_second, 0) / Math.max(runs.length, 1);
  const avgP95LatencyMs = runs.reduce((sum, run) => sum + run.latency_ms.p95, 0) / Math.max(runs.length, 1);
  const avgSuccessRate = runs.reduce((sum, run) => sum + run.success_rate, 0) / Math.max(runs.length, 1);

  const dbGroups = new Map<DatabaseMode, PerformanceRunResult[]>();
  const scenarioGroups = new Map<string, PerformanceRunResult[]>();

  for (const run of runs) {
    const dbRuns = dbGroups.get(run.db_mode) ?? [];
    dbRuns.push(run);
    dbGroups.set(run.db_mode, dbRuns);

    const scenarioKey = `${run.scenario_id}:${run.db_mode}`;
    const scenarioRuns = scenarioGroups.get(scenarioKey) ?? [];
    scenarioRuns.push(run);
    scenarioGroups.set(scenarioKey, scenarioRuns);
  }

  const dbComparison = Array.from(dbGroups.entries()).map(([dbMode, dbRuns]) => {
    const bestRun = dbRuns.reduce((currentBest, run) => (!currentBest || run.requests_per_second > currentBest.requests_per_second ? run : currentBest), undefined as PerformanceRunResult | undefined);

    return {
      db_mode: dbMode,
      runs: dbRuns.length,
      total_requests: dbRuns.reduce((sum, run) => sum + run.requests, 0),
      avg_requests_per_second: toFixedNumber(dbRuns.reduce((sum, run) => sum + run.requests_per_second, 0) / Math.max(dbRuns.length, 1)),
      avg_p95_latency_ms: toFixedNumber(dbRuns.reduce((sum, run) => sum + run.latency_ms.p95, 0) / Math.max(dbRuns.length, 1)),
      avg_success_rate: toFixedNumber(dbRuns.reduce((sum, run) => sum + run.success_rate, 0) / Math.max(dbRuns.length, 1)),
      best_run_label: bestRun?.label ?? "",
    };
  });

  const scenarioComparison = Array.from(scenarioGroups.entries()).map(([, scenarioRuns]) => ({
    scenario_id: scenarioRuns[0].scenario_id,
    scenario_name: scenarioRuns[0].scenario_name,
    db_mode: scenarioRuns[0].db_mode,
    runs: scenarioRuns.length,
    avg_requests_per_second: toFixedNumber(scenarioRuns.reduce((sum, run) => sum + run.requests_per_second, 0) / Math.max(scenarioRuns.length, 1)),
    avg_p95_latency_ms: toFixedNumber(scenarioRuns.reduce((sum, run) => sum + run.latency_ms.p95, 0) / Math.max(scenarioRuns.length, 1)),
    avg_success_rate: toFixedNumber(scenarioRuns.reduce((sum, run) => sum + run.success_rate, 0) / Math.max(scenarioRuns.length, 1)),
  }));

  const dbTrends = Array.from(dbGroups.entries()).map(([dbMode, dbRuns]) => {
    const buckets = new Map<number, { requests: number; successRateTotal: number; latencyTotal: number; runs: number }>();

    for (const run of dbRuns) {
      for (const point of run.timeline) {
        const existing = buckets.get(point.second) ?? {
          requests: 0,
          successRateTotal: 0,
          latencyTotal: 0,
          runs: 0,
        };

        existing.requests += point.requests;
        existing.successRateTotal += point.success_rate;
        existing.latencyTotal += point.avg_latency_ms;
        existing.runs += 1;
        buckets.set(point.second, existing);
      }
    }

    return {
      db_mode: dbMode,
      timeline: Array.from(buckets.entries())
        .sort(([left], [right]) => left - right)
        .map(([second, bucket]) => ({
          second,
          requests_per_second: toFixedNumber(bucket.requests / Math.max(bucket.runs, 1)),
          avg_latency_ms: toFixedNumber(bucket.latencyTotal / Math.max(bucket.runs, 1)),
          success_rate: toFixedNumber(bucket.successRateTotal / Math.max(bucket.runs, 1)),
        })),
    };
  });

  const fastestRun = runs.reduce((currentBest, run) => (!currentBest || run.requests_per_second > currentBest.requests_per_second ? run : currentBest), undefined as PerformanceRunResult | undefined);
  const lowestP95Run = runs.reduce((currentBest, run) => (!currentBest || run.latency_ms.p95 < currentBest.latency_ms.p95 ? run : currentBest), undefined as PerformanceRunResult | undefined);

  return {
    totals: {
      total_runs: runs.length,
      total_requests: totalRequests,
      total_succeeded: totalSucceeded,
      total_failed: totalFailed,
      avg_requests_per_second: toFixedNumber(avgRequestsPerSecond),
      avg_p95_latency_ms: toFixedNumber(avgP95LatencyMs),
      avg_success_rate: toFixedNumber(avgSuccessRate),
    },
    db_comparison: dbComparison,
    scenario_comparison: scenarioComparison,
    db_trends: dbTrends,
    highlights: {
      fastest_run_label: fastestRun?.label ?? null,
      lowest_p95_run_label: lowestP95Run?.label ?? null,
    },
  };
};

export const runPerformanceScenario = async (options: RunPerformanceScenarioOptions): Promise<PerformanceRunResult> => {
  const url = buildUrl(options.baseUrl, options.scenario, options.dbMode);
  const runStartedAt = performance.now();
  const deadline = runStartedAt + options.durationSeconds * 1000;
  const samples: Sample[] = [];

  const worker = async (): Promise<void> => {
    while (performance.now() < deadline) {
      const requestStartedAt = performance.now();

      try {
        const response = await fetch(url, {
          method: options.scenario.method,
        });

        await response.arrayBuffer();
        samples.push({
          completedAtMs: performance.now() - runStartedAt,
          durationMs: performance.now() - requestStartedAt,
          ok: response.ok,
          status: response.status,
        });
      } catch {
        samples.push({
          completedAtMs: performance.now() - runStartedAt,
          durationMs: performance.now() - requestStartedAt,
          ok: false,
          status: 0,
        });
      }
    }
  };

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  const totalElapsedMs = Math.max(performance.now() - runStartedAt, 1);
  const durations = samples.map((sample) => sample.durationMs).sort((left, right) => left - right);
  const succeeded = samples.filter((sample) => sample.ok).length;
  const failed = samples.length - succeeded;
  const statusCounts = samples.reduce<Record<string, number>>((acc, sample) => {
    const key = String(sample.status);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    run_id: `${options.scenario.id}-${options.dbMode}-${options.iteration}`,
    label: `${options.scenario.name} / ${options.dbMode.toUpperCase()} / Run ${options.iteration}`,
    scenario_id: options.scenario.id,
    scenario_name: options.scenario.name,
    db_mode: options.dbMode,
    iteration: options.iteration,
    path: options.scenario.path,
    url,
    method: options.scenario.method,
    duration_seconds: options.durationSeconds,
    concurrency: options.concurrency,
    requests: samples.length,
    succeeded,
    failed,
    success_rate: toFixedNumber((succeeded / Math.max(samples.length, 1)) * 100),
    requests_per_second: toFixedNumber((samples.length / totalElapsedMs) * 1000),
    latency_ms: {
      min: toFixedNumber(durations[0] ?? 0),
      avg: toFixedNumber(durations.reduce((sum, value) => sum + value, 0) / Math.max(durations.length, 1)),
      p50: toFixedNumber(percentile(durations, 0.5)),
      p95: toFixedNumber(percentile(durations, 0.95)),
      p99: toFixedNumber(percentile(durations, 0.99)),
      max: toFixedNumber(durations[durations.length - 1] ?? 0),
    },
    status_counts: statusCounts,
    timeline: buildTimeline(samples),
  };
};

export const runPerformanceSuite = async (options: RunPerformanceSuiteOptions): Promise<PerformanceSuiteResult> => {
  const startedAt = new Date().toISOString();
  const runs: PerformanceRunResult[] = [];

  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    for (const scenario of options.scenarios) {
      for (const dbMode of options.dbModes) {
        runs.push(
          await runPerformanceScenario({
            baseUrl: options.baseUrl,
            scenario,
            dbMode,
            iteration,
            durationSeconds: options.durationSeconds,
            concurrency: options.concurrency,
          }),
        );
      }
    }
  }

  return {
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    runs,
    analytics: summarizeRuns(runs),
  };
};
