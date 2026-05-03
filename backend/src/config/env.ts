import dotenv from "dotenv";

dotenv.config();

export type AppConfig = {
  nodeEnv: string;
  port: number;
  logLevel: string;
  corsOrigin: string;
  mongodbUri?: string;
  mongodbDbName?: string;
  postgresUri?: string;
  seedOnStart: boolean;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const parseDbNameFromUri = (uri: string): string => {
  try {
    const parsed = new URL(uri);
    const path = parsed.pathname.replace(/^\//, "");
    return path || "mongo_showcase";
  } catch {
    return "mongo_showcase";
  }
};

export const getConfig = (): AppConfig => {
  const mongodbUri = process.env.MONGODB_URI;
  const postgresUri = process.env.POSTGRES_URI ?? process.env.POSTGRESQL_URI;

  if (!mongodbUri && !postgresUri) {
    throw new Error("Missing database connection. Set MONGODB_URI, POSTGRES_URI, or both.");
  }

  const portRaw = process.env.PORT ?? "3000";
  const port = Number(portRaw);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port,
    logLevel: process.env.LOG_LEVEL ?? "info",
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
    mongodbUri,
    mongodbDbName: mongodbUri
      ? process.env.MONGODB_DB_NAME ?? parseDbNameFromUri(mongodbUri)
      : undefined,
    postgresUri,
    seedOnStart: toBoolean(process.env.SEED_ON_START, false)
  };
};
