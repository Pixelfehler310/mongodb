import { buildGrafanaDashboardUrl, deriveSuiteId, parseIntegerFlag, relativeOutputPath, resolveOutputDir, runK6Scenario } from "./lib/runner.mjs";
import { parseDbModes, parseScenarioIds, validateDbModes, validateScenarioIds } from "./lib/scenarios.mjs";

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

  const scenarioIds = parseScenarioIds(values.get("scenario") ?? positional[0]);
  const dbModes = parseDbModes(values.get("db") ?? positional[1]);
  validateScenarioIds(scenarioIds);
  validateDbModes(dbModes);

  if (scenarioIds.length !== 1) {
    throw new Error("benchmark:local:scenario expects exactly one scenario via --scenario");
  }

  if (dbModes.length !== 1) {
    throw new Error("benchmark:local:scenario expects exactly one db mode via --db");
  }

  return {
    scenarioId: scenarioIds[0],
    dbMode: dbModes[0],
    outputDir: resolveOutputDir(values.get("output-dir") ?? positional[2]),
    vus: parseIntegerFlag(values.get("vus") ?? positional[3], 50, "vus"),
    warmupSeconds: parseIntegerFlag(values.get("warmup") ?? positional[4], 30, "warmup"),
    durationSeconds: parseIntegerFlag(values.get("duration") ?? positional[5], 60, "duration"),
    seedCount: parseIntegerFlag(values.get("seed-count") ?? positional[6], 10000, "seed-count"),
  };
};

const main = async () => {
  const options = parseArgs();
  const suiteId = deriveSuiteId(options.outputDir);
  const summary = await runK6Scenario({
    ...options,
    suiteId,
  });

  console.log(
    JSON.stringify(
      {
        suite_id: suiteId,
        output_dir: relativeOutputPath(options.outputDir),
        grafana_url: buildGrafanaDashboardUrl({
          suiteId,
          scenarioId: options.scenarioId,
          dbMode: options.dbMode,
          runId: summary.run_id,
        }),
        result: summary,
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