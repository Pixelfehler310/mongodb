import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeK6Run } from "./report.mjs";
import { scenarioDefinitions } from "./scenarios.mjs";

const benchmarkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(benchmarkRoot, "..");
const resultsRoot = path.join(benchmarkRoot, "results");
const grafanaDashboardUid = "k6-live-overview";
const grafanaBaseUrl = "http://localhost:3001";

const sanitizePathSegment = (value) => value.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();

const timestampSegment = () => new Date().toISOString().replace(/[:.]/g, "-");

export const parseIntegerFlag = (value, fallback, label) => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
};

export const resolveOutputDir = (relativeOutputDir) => path.join(resultsRoot, relativeOutputDir || timestampSegment());

export const relativeOutputPath = (absolutePath) => path.relative(projectRoot, absolutePath).split(path.sep).join("/");

export const deriveSuiteId = (outputDir) => sanitizePathSegment(path.basename(outputDir));

const buildRunId = (suiteId, scenarioId, dbMode) => sanitizePathSegment(`${suiteId}-${scenarioId}-${dbMode}`);

export const buildGrafanaDashboardUrl = ({ suiteId, scenarioId, dbMode, runId }) => {
  const params = new URLSearchParams({
    orgId: "1",
    "var-suite_id": suiteId,
    from: "now-30m",
    to: "now",
  });

  if (scenarioId) {
    params.set("var-scenario", scenarioId);
  }

  if (dbMode) {
    params.set("var-db_mode", dbMode);
  }

  if (runId) {
    params.set("var-run_id", runId);
  }

  return `${grafanaBaseUrl}/d/${grafanaDashboardUid}/${grafanaDashboardUid}?${params.toString()}`;
};

export const writeSuiteSummary = async (outputDir, payload) => {
  const target = path.join(outputDir, "suite-summary.json");
  await writeFile(target, JSON.stringify(payload, null, 2));
  return target;
};

export const runK6Scenario = async ({ scenarioId, dbMode, outputDir, vus, warmupSeconds, durationSeconds, seedCount, suiteId: providedSuiteId }) => {
  const scenario = scenarioDefinitions[scenarioId];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  await mkdir(outputDir, { recursive: true });

  const suiteId = providedSuiteId ?? deriveSuiteId(outputDir);
  const runId = buildRunId(suiteId, scenarioId, dbMode);
  const grafanaUrl = buildGrafanaDashboardUrl({
    suiteId,
    scenarioId,
    dbMode,
    runId,
  });

  const resultFileName = `${sanitizePathSegment(scenarioId)}__${sanitizePathSegment(dbMode)}.json`;
  const hostResultPath = path.join(outputDir, resultFileName);
  const containerResultPath = `/results/${path.relative(resultsRoot, hostResultPath).split(path.sep).join("/")}`;

  const dockerArgs = [
    "compose",
    "--env-file",
    ".env.local",
    "-f",
    "docker-compose.local.yml",
    "--profile",
    "benchmark",
    "run",
    "--rm",
    "-T",
    "-e",
    `K6_DB_MODE=${dbMode}`,
    "-e",
    `K6_VUS=${vus}`,
    "-e",
    `K6_WARMUP_SECONDS=${warmupSeconds}`,
    "-e",
    `K6_DURATION_SECONDS=${durationSeconds}`,
    "-e",
    `K6_SEED_COUNT=${seedCount}`,
    "-e",
    `K6_TIMEOUT=${scenario.timeout ?? "120s"}`,
    "benchmark",
    "run",
    "--summary-export",
    containerResultPath,
    "--out",
    "influxdb=http://influxdb:8086/k6",
    "--tag",
    `suite_id=${suiteId}`,
    "--tag",
    `run_id=${runId}`,
    "--tag",
    `scenario_id=${scenarioId}`,
    "--tag",
    `scenario_label=${scenario.label}`,
    "--tag",
    `db_mode=${dbMode}`,
    `/scripts/${scenario.file}`,
  ];

  const result = spawnSync("docker", dockerArgs, {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`k6 run failed for ${scenarioId}/${dbMode}`);
  }

  const summary = JSON.parse(await readFile(hostResultPath, "utf8"));

  return summarizeK6Run(summary, {
    suiteId,
    runId,
    scenarioId,
    scenarioLabel: scenario.label,
    dbMode,
    outputFile: relativeOutputPath(hostResultPath),
    grafanaUrl,
  });
};