import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "../env";
import * as schema from "./schema";

function resolveDbFile(): string {
  const url = env.databaseUrl;
  const file = url.startsWith("file:") ? url.slice("file:".length) : url;
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return abs;
}

declare global {
  var __valuextractDb: ReturnType<typeof create> | undefined;
}

function create() {
  const sqlite = new Database(resolveDbFile());
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

const instance = globalThis.__valuextractDb ?? create();
if (process.env.NODE_ENV !== "production") globalThis.__valuextractDb = instance;

export const sqlite = instance.sqlite;
export const db = instance.db;
export { schema };
