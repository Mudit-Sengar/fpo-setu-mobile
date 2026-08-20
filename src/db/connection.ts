import { open, type DB } from "@op-engineering/op-sqlite";
// authz.ts has no runtime imports of its own (its only import is type-only), so
// this does not create an import cycle back through the repositories.
import { AuthzError } from "./authz";
import { notifyDataChanged } from "./invalidation";

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

/**
 * Wraps a DB operation so failures arrive as a typed DbError with context.
 *
 * AuthzError passes through untouched. Several repository checks can only run
 * after a query — "is this response against a request you own?" — so they throw
 * from inside this wrapper. Rewrapping them would turn a precise, showable
 * message ("Only the party that posted the request can decide this.") into a
 * generic database failure, and `describeWriteError` would stop recognising it.
 */
export async function withDb<T>(what: string, fn: (database: DB) => Promise<T>): Promise<T> {
  try {
    return await fn(getDB());
  } catch (e) {
    if (e instanceof AuthzError) throw e;
    throw new DbError(`Database operation failed: ${what}`, e);
  }
}

/**
 * `withDb` for operations that change data: on success it announces the write so
 * every mounted query re-runs.
 *
 * Mutations use this instead of `withDb` so that refreshing the UI is a property
 * of writing, not something each button has to remember. A failed write notifies
 * nothing, because nothing changed.
 */
export async function withWrite<T>(what: string, fn: (database: DB) => Promise<T>): Promise<T> {
  const result = await withDb(what, fn);
  notifyDataChanged();
  return result;
}
