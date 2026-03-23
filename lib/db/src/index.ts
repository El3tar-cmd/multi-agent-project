import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "platform.db");

import { mkdirSync } from "fs";
try {
  mkdirSync(path.dirname(dbPath), { recursive: true });
} catch {}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export const rawDb = sqlite;

export * from "./schema";
