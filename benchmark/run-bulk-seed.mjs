import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseIntegerFlag } from "./lib/runner.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

  const db = values.get("db") ?? positional[0] ?? "mongo";
  if (!["mongo", "postgres", "both"].includes(db)) {
    throw new Error("db must be one of: mongo, postgres, both");
  }

  return {
    db,
    total: parseIntegerFlag(values.get("total") ?? positional[1], 100000, "total"),
    batchSize: parseIntegerFlag(values.get("batch-size") ?? positional[2], 5000, "batch-size"),
    clearExisting: values.get("clear-existing") ?? positional[3] ?? "true",
    seed: parseIntegerFlag(values.get("seed") ?? positional[4], 20260503, "seed"),
  };
};

const main = () => {
  const options = parseArgs();
  const dockerArgs = [
    "compose",
    "--env-file",
    ".env.local",
    "-f",
    "docker-compose.local.yml",
    "exec",
    "-T",
    "backend",
    "node",
    "dist/scripts/bulk-seed.js",
    "--db",
    options.db,
    "--total",
    String(options.total),
    "--batch-size",
    String(options.batchSize),
    "--clear-existing",
    String(options.clearExisting),
    "--seed",
    String(options.seed),
  ];

  const result = spawnSync("docker", dockerArgs, {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("docker bulk seed failed");
  }
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}