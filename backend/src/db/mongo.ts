import { Db, MongoClient, ServerApiVersion } from "mongodb";
import type { Logger } from "pino";

let client: MongoClient | null = null;
let db: Db | null = null;

export const connectToMongo = async (
  uri: string,
  dbName: string,
  logger: Logger
): Promise<void> => {
  if (client && db) {
    return;
  }

  const mongoClient = new MongoClient(uri, {
    maxPoolSize: 100,
    serverApi: {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: true
    }
  });

  await mongoClient.connect();
  const database = mongoClient.db(dbName);
  await database.command({ ping: 1 });

  client = mongoClient;
  db = database;

  logger.info({ dbName }, "Connected to MongoDB Atlas");
};

export const getDb = (): Db => {
  if (!db) {
    throw new Error("MongoDB is not connected");
  }

  return db;
};

export const pingMongo = async (): Promise<boolean> => {
  if (!db) {
    return false;
  }

  try {
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
};

export const closeMongo = async (): Promise<void> => {
  if (client) {
    await client.close();
  }

  client = null;
  db = null;
};
