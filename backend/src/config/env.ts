import dotenv from "dotenv";

dotenv.config();

export type AppConfig = {
  nodeEnv: string;
  port: number;
  logLevel: string;
  corsOrigin: string;
  mongodbUri: string;
  mongodbDbName: string;
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

  if (!mongodbUri) {
    throw new Error("Missing required env variable MONGODB_URI");
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
    mongodbDbName: process.env.MONGODB_DB_NAME ?? parseDbNameFromUri(mongodbUri),
    seedOnStart: toBoolean(process.env.SEED_ON_START, false)
  };
};
