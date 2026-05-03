import { getDb, isMongoConnected } from "./mongo.js";
import { getPostgresPool, isPostgresConnected } from "./postgres.js";
import { seedPostgresProducts } from "./seed-postgres.js";
import { seedProducts, type SeedOptions } from "./seed.js";
import type { DatabaseMode, SeedTarget } from "./database-mode.js";
import { HttpError } from "../utils/http-error.js";

type SeedDatabaseResult = {
  insertedCount: number;
  cleared: boolean;
};

export type SeedResult = {
  target: SeedTarget;
  totalInsertedCount: number;
  results: Partial<Record<DatabaseMode, SeedDatabaseResult>>;
};

const seedMongo = async (options: SeedOptions): Promise<SeedDatabaseResult> => {
  if (!isMongoConnected()) {
    throw new HttpError(503, "DATABASE_UNAVAILABLE", "MongoDB is not connected");
  }

  return seedProducts(getDb(), options);
};

const seedPostgres = async (options: SeedOptions): Promise<SeedDatabaseResult> => {
  if (!isPostgresConnected()) {
    throw new HttpError(503, "DATABASE_UNAVAILABLE", "PostgreSQL is not connected");
  }

  return seedPostgresProducts(getPostgresPool(), options);
};

export const seedDatabases = async (target: SeedTarget, options: SeedOptions): Promise<SeedResult> => {
  const results: SeedResult["results"] = {};

  if (target === "mongo" || target === "both") {
    results.mongo = await seedMongo(options);
  }

  if (target === "postgres" || target === "both") {
    results.postgres = await seedPostgres(options);
  }

  return {
    target,
    totalInsertedCount: Object.values(results).reduce((sum, result) => sum + result.insertedCount, 0),
    results
  };
};