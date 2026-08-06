import { open, type DB } from "@op-engineering/op-sqlite";

/**
 * Single owner of the SQLite handle. Nothing outside src/db/ should import
 * @op-engineering/op-sqlite directly — screens go through the repositories in
 * src/db/repositories/ so raw SQL stays in one place.
 */

export const DB_NAME = "fposetu.sqlite";

let db: DB | null = null;

/** Opens (once) and returns the shared database handle. */
export function getDB(): DB {
  if (db == null) {
    db = open({ name: DB_NAME });
    // Enforce the foreign keys declared in the schema — SQLite ignores them unless
    // this is switched on, per connection.
    db.executeSync("PRAGMA foreign_keys = ON;");
  }
  return db;
}

/** Closes the handle. Only used by tests / a full reset. */
export function closeDB(): void {
  if (db != null) {
    db.close();
    db = null;
  }
}

/** Error type surfaced to callers so UI code never sees a raw driver error. */
export class DbError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DbError";
    this.cause = cause;
  }
}

/** Wraps a DB operation so failures arrive as a typed DbError with context. */
export async function withDb<T>(what: string, fn: (database: DB) => Promise<T>): Promise<T> {
  try {
    return await fn(getDB());
  } catch (e) {
    throw new DbError(`Database operation failed: ${what}`, e);
  }
}
