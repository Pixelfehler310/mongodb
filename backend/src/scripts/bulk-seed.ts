import pino from "pino";
import { getConfig } from "../config/env.js";
import { ensureProductIndexes } from "../db/indexes.js";
import { connectToMongo, closeMongo, getDb } from "../db/mongo.js";
import { ensurePostgresSchema } from "../db/postgres-schema.js";
import { connectToPostgres, closePostgres, getPostgresPool } from "../db/postgres.js";
import { seedDatabases } from "../db/seed-dual.js";
import type { SeedTarget } from "../db/database-mode.js";

type CliOptions = {
  db: SeedTarget;
  total: number;
  batchSize: number;
  clearExisting: boolean;
  seed: number;
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

const parseDb = (value: string | undefined): SeedTarget => {
  if (!value) {
    return "mongo";
  }

  if (value === "both" || value === "mongo" || value === "postgres") {
    return value;
  }

  throw new Error("db must be one of: mongo, postgres, both");
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

  return {
    db: parseDb(values.get("db")),
    total: parseInteger(values.get("total"), 100000, "total"),
    batchSize: parseInteger(values.get("batch-size"), 5000, "batch-size"),
    clearExisting: values.get("clear-existing") !== "false",
    seed: parseInteger(values.get("seed"), 20260503, "seed"),
  };
};

const main = async (): Promise<void> => {
  const config = getConfig();
  const logger = pino({ level: config.logLevel });
  const options = parseArgs();

  if ((options.db === "mongo" || options.db === "both") && !config.mongodbUri) {
    throw new Error("MONGODB_URI is required for mongo seeding");
  }

  if ((options.db === "postgres" || options.db === "both") && !config.postgresUri) {
    throw new Error("POSTGRES_URI is required for postgres seeding");
  }

  if (options.batchSize > options.total) {
    options.batchSize = options.total;
  }

  try {
    if (config.mongodbUri && config.mongodbDbName && (options.db === "mongo" || options.db === "both")) {
      await connectToMongo(config.mongodbUri, config.mongodbDbName, logger);
      await ensureProductIndexes(getDb(), logger);
    }

    if (config.postgresUri && (options.db === "postgres" || options.db === "both")) {
      await connectToPostgres(config.postgresUri, logger);
      await ensurePostgresSchema(getPostgresPool(), logger);
    }

    const startedAt = performance.now();
    let inserted = 0;

    for (let startIndex = 0; startIndex < options.total; startIndex += options.batchSize) {
      const count = Math.min(options.batchSize, options.total - startIndex);
      const result = await seedDatabases(options.db, {
        count,
        clearExisting: options.clearExisting && startIndex === 0,
        seed: options.seed,
        startIndex,
      });

      inserted += result.totalInsertedCount;
      logger.info(
        {
          batch_start: startIndex,
          batch_count: count,
          inserted_total: inserted,
          target: options.db,
        },
        "Bulk seed batch completed",
      );
    }

    const elapsedMs = performance.now() - startedAt;
    logger.info(
      {
        target: options.db,
        inserted,
        batch_size: options.batchSize,
        total_ms: Number(elapsedMs.toFixed(2)),
        rows_per_second: Number(((inserted / elapsedMs) * 1000).toFixed(2)),
      },
      "Bulk seed finished",
    );
  } finally {
    await Promise.all([closeMongo(), closePostgres()]);
  }
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
