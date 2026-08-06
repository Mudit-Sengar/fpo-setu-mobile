import type { DB } from "@op-engineering/op-sqlite";
import { MIGRATION_001 } from "./001_initial_schema";
import { MIGRATION_002 } from "./002_auth";

/**
 * Ordered migrations. Append new entries; never renumber or edit a shipped one.
 * `PRAGMA user_version` records how many have been applied, so re-running is a no-op.
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  { version: 1, sql: MIGRATION_001 },
  { version: 2, sql: MIGRATION_002 },
];

export const LATEST_VERSION = MIGRATIONS.length;

/** Applies any migrations the open database hasn't seen yet. */
export async function runMigrations(db: DB): Promise<void> {
  const res = await db.execute("PRAGMA user_version;");
  const current = Number(res.rows?.[0]?.user_version ?? 0);

  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;

    // Each migration is one transaction: a partial schema is worse than none.
    await db.transaction(async (tx) => {
      for (const statement of splitStatements(m.sql)) {
        await tx.execute(statement);
      }
      // PRAGMA can't be parameterised, and `version` is an integer literal we control.
      await tx.execute(`PRAGMA user_version = ${m.version};`);
    });
  }
}

/**
 * op-sqlite's execute() takes a single statement, so the migration blob is split
 * on semicolons. Comment lines are stripped FIRST — otherwise a chunk that opens
 * with a `--` banner would look like a pure comment and its CREATE TABLE would be
 * silently dropped.
 *
 * Safe here because the schema contains no semicolons inside string literals or
 * triggers — keep it that way, or switch to executeBatch.
 */
function splitStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  return withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => `${s};`);
}
