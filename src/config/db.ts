import mongoose from "mongoose";
import { env } from "./env";

mongoose.set("strictQuery", true);

// Serverless functions reuse the same process between requests, so the connection is cached
const cache = globalThis as typeof globalThis & { _salonbookDb?: Promise<typeof mongoose> };

export function connectDB() {
  cache._salonbookDb ??= mongoose
    .connect(env.mongoUri(), { dbName: env.dbName, serverSelectionTimeoutMS: 10000 })
    .catch((err) => {
      // Let the next request try again instead of keeping a failed promise
      cache._salonbookDb = undefined;
      throw err;
    });
  return cache._salonbookDb;
}
