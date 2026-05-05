type CliOptions = {
  url: string;
  durationSeconds: number;
  concurrency: number;
  method: string;
  body?: string;
  headers: Record<string, string>;
};

type Sample = {
  durationMs: number;
  ok: boolean;
  status: number;
};

const parseInteger = (value: string | undefined, fallback: number, label: string): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
};

const percentile = (sorted: number[], fraction: number): number => {
  if (sorted.length === 0) {
    return 0;
  }

  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      values.set(key, "true");
      continue;
    }

    values.set(key, next);
    index += 1;
  }

  const url = values.get("url") ?? "http://localhost:3000/api/v1/products?db=mongo&limit=20";
  const method = (values.get("method") ?? "GET").toUpperCase();
  const body = values.get("body");
  const headers: Record<string, string> = {};

  if (body) {
    headers["content-type"] = "application/json";
  }

  return {
    url,
    durationSeconds: parseInteger(values.get("duration"), 30, "duration"),
    concurrency: parseInteger(values.get("concurrency"), 20, "concurrency"),
    method,
    body,
    headers,
  };
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const deadline = Date.now() + options.durationSeconds * 1000;
  const samples: Sample[] = [];

  const worker = async (): Promise<void> => {
    while (Date.now() < deadline) {
      const startedAt = performance.now();

      try {
        const response = await fetch(options.url, {
          method: options.method,
          headers: options.headers,
          body: options.body,
        });

        await response.arrayBuffer();
        samples.push({
          durationMs: performance.now() - startedAt,
          ok: response.ok,
          status: response.status,
        });
      } catch {
        samples.push({
          durationMs: performance.now() - startedAt,
          ok: false,
          status: 0,
        });
      }
    }
  };

  const startedAt = performance.now();
  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  const totalMs = performance.now() - startedAt;

  const durations = samples.map((sample) => sample.durationMs).sort((left, right) => left - right);
  const succeeded = samples.filter((sample) => sample.ok).length;
  const failed = samples.length - succeeded;
  const statusCounts = samples.reduce<Record<string, number>>((acc, sample) => {
    const key = String(sample.status);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        url: options.url,
        method: options.method,
        concurrency: options.concurrency,
        duration_seconds: options.durationSeconds,
        requests: samples.length,
        succeeded,
        failed,
        requests_per_second: Number(((samples.length / totalMs) * 1000).toFixed(2)),
        latency_ms: {
          min: Number((durations[0] ?? 0).toFixed(2)),
          avg: Number((durations.reduce((sum, value) => sum + value, 0) / Math.max(durations.length, 1)).toFixed(2)),
          p50: Number(percentile(durations, 0.5).toFixed(2)),
          p95: Number(percentile(durations, 0.95).toFixed(2)),
          p99: Number(percentile(durations, 0.99).toFixed(2)),
          max: Number((durations[durations.length - 1] ?? 0).toFixed(2)),
        },
        status_counts: statusCounts,
      },
      null,
      2,
    ),
  );
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
