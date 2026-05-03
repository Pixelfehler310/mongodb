import pg from "pg";
import type { Logger } from "pino";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export const connectToPostgres = async (connectionString: string, logger: Logger): Promise<void> => {
  if (pool) {
    return;
  }

  const postgresPool = new Pool({
    connectionString,
    max: 20
  });

  await postgresPool.query("SELECT 1");
  pool = postgresPool;

  logger.info("Connected to PostgreSQL");
};

export const getPostgresPool = (): pg.Pool => {
  if (!pool) {
    throw new Error("PostgreSQL is not connected");
  }

  return pool;
};

export const isPostgresConnected = (): boolean => pool !== null;

export const pingPostgres = async (): Promise<boolean> => {
  if (!pool) {
    return false;
  }

  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
};

export const closePostgres = async (): Promise<void> => {
  if (pool) {
    await pool.end();
  }

  pool = null;
};