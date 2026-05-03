import { HttpError } from "../utils/http-error.js";

export const databaseModes = ["mongo", "postgres"] as const;

export type DatabaseMode = (typeof databaseModes)[number];

export type SeedTarget = DatabaseMode | "both";

const firstString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string");
  }

  return undefined;
};

export const parseDatabaseMode = (value: unknown): DatabaseMode => {
  const raw = firstString(value)?.toLowerCase();

  if (!raw || raw === "mongodb") {
    return "mongo";
  }

  if (raw === "mongo" || raw === "postgres" || raw === "postgresql") {
    return raw === "postgresql" ? "postgres" : raw;
  }

  throw new HttpError(400, "INVALID_DATABASE_MODE", `Unsupported database mode: ${raw}`);
};

export const parseSeedTarget = (value: unknown): SeedTarget => {
  const raw = firstString(value)?.toLowerCase();

  if (!raw || raw === "both") {
    return "both";
  }

  return parseDatabaseMode(raw);
};