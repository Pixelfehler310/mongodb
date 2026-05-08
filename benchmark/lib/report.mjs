const readMetricValues = (summary, metricName) => {
  const metric = summary.metrics?.[metricName];
  if (!metric) {
    return {};
  }

  return metric.values ?? metric;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
};

export const summarizeK6Run = (summary, metadata) => {
  const duration = readMetricValues(summary, "benchmark_http_req_duration_ms");
  const requests = readMetricValues(summary, "benchmark_http_reqs");
  const failed = readMetricValues(summary, "benchmark_http_req_failed");
  const checks = readMetricValues(summary, "benchmark_checks");
  const failedRate = Number(failed.value ?? 0);
  const checkRate = Number(checks.value ?? 0);

  return {
    suite_id: metadata.suiteId,
    run_id: metadata.runId,
    scenario_id: metadata.scenarioId,
    scenario_label: metadata.scenarioLabel,
    db_mode: metadata.dbMode,
    output_file: metadata.outputFile,
    grafana_url: metadata.grafanaUrl,
    requests: toNumber(requests.count, 0),
    requests_per_second: toNumber(requests.rate, 0),
    success_rate: toNumber((1 - failedRate) * 100, 100),
    checks_rate: toNumber(checkRate * 100, 0),
    latency_ms: {
      min: toNumber(duration.min, 0),
      avg: toNumber(duration.avg, 0),
      p50: toNumber(duration.med, 0),
      p95: toNumber(duration["p(95)"], 0),
      p99: toNumber(duration["p(99)"], 0),
      max: toNumber(duration.max, 0),
    },
  };
};