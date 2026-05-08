import { buildGrafanaDashboardUrl, deriveSuiteId, parseIntegerFlag, relativeOutputPath, resolveOutputDir, runK6Scenario, writeSuiteSummary } from "./lib/runner.mjs";
import { defaultScenarioIds, parseDbModes, parseScenarioIds, validateDbModes, validateScenarioIds } from "./lib/scenarios.mjs";

const isScenarioSelection = (value) => {
  if (!value) {
    return false;
  }

  try {
    validateScenarioIds(parseScenarioIds(value));
    return true;
  } catch {
    return false;
  }
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const values = new Map();
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
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

  const positionalOffset = values.has("scenarios") || isScenarioSelection(positional[0]) ? 0 : 1;
  const scenarioIds = parseScenarioIds(values.get("scenarios") ?? (positionalOffset === 0 ? positional[0] : undefined));
  const dbModes = parseDbModes(values.get("db") ?? positional[positionalOffset]);
  validateScenarioIds(scenarioIds);
  validateDbModes(dbModes);

  return {
    scenarioIds,
    dbModes,
    outputDir: resolveOutputDir(values.get("output-dir") ?? (positionalOffset === 0 ? positional[2] : positional[0])),
    vus: parseIntegerFlag(values.get("vus") ?? positional[positionalOffset + 1], 50, "vus"),
    warmupSeconds: parseIntegerFlag(values.get("warmup") ?? positional[positionalOffset + 2], 30, "warmup"),
    durationSeconds: parseIntegerFlag(values.get("duration") ?? positional[positionalOffset + 3], 60, "duration"),
    seedCount: parseIntegerFlag(values.get("seed-count") ?? positional[positionalOffset + 4], 10000, "seed-count"),
  };
};

const main = async () => {
  const options = parseArgs();
  const startedAt = new Date().toISOString();
  const results = [];
  const suiteId = deriveSuiteId(options.outputDir);

  for (const scenarioId of options.scenarioIds) {
    for (const dbMode of options.dbModes) {
      results.push(
        await runK6Scenario({
          scenarioId,
          dbMode,
          outputDir: options.outputDir,
          vus: options.vus,
          warmupSeconds: options.warmupSeconds,
          durationSeconds: options.durationSeconds,
          seedCount: options.seedCount,
          suiteId,
        }),
      );
    }
  }

  const suiteSummary = {
    suite_id: suiteId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    plan: {
      scenarios: options.scenarioIds,
      db_modes: options.dbModes,
      vus: options.vus,
      warmup_seconds: options.warmupSeconds,
      duration_seconds: options.durationSeconds,
      seed_count: options.seedCount,
      total_runs: options.scenarioIds.length * options.dbModes.length,
      default_scenarios: defaultScenarioIds,
    },
    grafana_url: buildGrafanaDashboardUrl({
      suiteId,
    }),
    results,
  };

  const suiteSummaryPath = await writeSuiteSummary(options.outputDir, suiteSummary);

  console.log(
    JSON.stringify(
      {
        suite_id: suiteId,
        output_dir: relativeOutputPath(options.outputDir),
        summary_file: relativeOutputPath(suiteSummaryPath),
        grafana_url: suiteSummary.grafana_url,
        results,
      },
      null,
      2,
    ),
  );
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});