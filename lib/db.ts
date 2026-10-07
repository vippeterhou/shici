import "server-only";

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join } from "node:path";

const databasePath = join(process.cwd(), "data", "shici.sqlite");

declare global {
  var shiciDatabase: Database.Database | undefined;
}

export function getDatabase(): Database.Database {
  if (global.shiciDatabase) {
    return global.shiciDatabase;
  }
  if (!existsSync(databasePath)) {
    throw new Error(
      `Poetry database not found at ${databasePath}. Run npm run build:data.`,
    );
  }
  const database = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  });
  database.pragma("query_only = ON");
  database.pragma("cache_size = -65536");
  database.pragma("mmap_size = 268435456");
  global.shiciDatabase = database;
  return database;
}
