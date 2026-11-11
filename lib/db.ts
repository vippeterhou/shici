import "server-only";

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join } from "node:path";

const databasePath = join(process.cwd(), "data", "shici.sqlite");

declare global {
  var shiciDatabase: Database.Database | undefined;
  var guangyunDatabase: Database.Database | undefined;
  var pingshuiyunDatabase: Database.Database | undefined;
}

export function getPingshuiyunDatabase(): Database.Database | null {
  return getLookupDatabase(
    "pingshuiyun_lookup.sqlite",
    global.pingshuiyunDatabase,
    (database) => {
      global.pingshuiyunDatabase = database;
    },
  );
}

export function getGuangyunDatabase(): Database.Database | null {
  return getLookupDatabase(
    "guangyun_lookup.sqlite",
    global.guangyunDatabase,
    (database) => {
      global.guangyunDatabase = database;
    },
  );
}

function getLookupDatabase(
  filename: string,
  cached: Database.Database | undefined,
  cache: (database: Database.Database) => void,
): Database.Database | null {
  if (cached) {
    return cached;
  }
  const path = join(process.cwd(), "data", filename);
  if (!existsSync(path)) {
    return null;
  }
  const database = new Database(path, {
    readonly: true,
    fileMustExist: true,
  });
  database.pragma("query_only = ON");
  cache(database);
  return database;
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
