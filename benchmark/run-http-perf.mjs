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

  return {
    url: values.get("url") ?? positional[0] ?? "http://localhost:3000/api/v1/products?db=mongo&limit=20",
    duration: parseIntegerFlag(values.get("duration") ?? positional[1], 30, "duration"),
    concurrency: parseIntegerFlag(values.get("concurrency") ?? positional[2], 20, "concurrency"),
    method: values.get("method") ?? positional[3] ?? "GET",
    body: values.get("body") ?? positional[4],
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
    "dist/scripts/perf-test.js",
    "--url",
    options.url,
    "--duration",
    String(options.duration),
    "--concurrency",
    String(options.concurrency),
    "--method",
    String(options.method),
  ];

  if (options.body) {
    dockerArgs.push("--body", options.body);
  }

  const result = spawnSync("docker", dockerArgs, {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("docker http perf test failed");
  }
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}