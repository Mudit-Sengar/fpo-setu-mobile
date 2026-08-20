import type { DB } from "@op-engineering/op-sqlite";
import { MIGRATION_001 } from "./001_initial_schema";
import { MIGRATION_002 } from "./002_auth";
import { MIGRATION_003 } from "./003_parties";
import { MIGRATION_004 } from "./004_requests";
import { MIGRATION_005 } from "./005_network";
import { MIGRATION_006 } from "./006_membership";
import { MIGRATION_007 } from "./007_orders";
import { MIGRATION_008 } from "./008_reviews";
import { MIGRATION_009 } from "./009_readiness";
import { MIGRATION_010 } from "./010_geography";
import { MIGRATION_011 } from "./011_services";

/**
 * Ordered migrations. Append new entries; never renumber or edit a shipped one.
 * `PRAGMA user_version` records how many have been applied, so re-running is a no-op.
 *
 * A migration supplies its statements as an ARRAY. 001 and 002 shipped as single
 * SQL blobs, so they are split here to keep their behaviour byte-identical — see
 * splitStatements for why nothing new should be written that way.
 */
const MIGRATIONS: { version: number; statements: string[] }[] = [
  { version: 1, statements: splitStatements(MIGRATION_001) },
  { version: 2, statements: splitStatements(MIGRATION_002) },
  { version: 3, statements: MIGRATION_003 },
  { version: 4, statements: MIGRATION_004 },
  { version: 5, statements: MIGRATION_005 },
  { version: 6, statements: MIGRATION_006 },
  { version: 7, statements: MIGRATION_007 },
  { version: 8, statements: MIGRATION_008 },
  { version: 9, statements: MIGRATION_009 },
  { version: 10, statements: MIGRATION_010 },
  { version: 11, statements: MIGRATION_011 },
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
      for (const statement of m.statements) {
        await tx.execute(statement);
      }
      // PRAGMA can't be parameterised, and `version` is an integer literal we control.
      await tx.execute(`PRAGMA user_version = ${m.version};`);
    });
  }
}

/**
 * Splits a legacy single-blob migration into statements.
 *
 * DEPRECATED — for migrations 001 and 002 only. The split is naive: it strips
 * `--` comment lines and then cuts on every semicolon, so a statement containing
 * a semicolon inside a string literal, a trigger body, or a view with a CASE
 * expression is silently truncated into fragments that either fail or, worse,
 * succeed as something else. 001 and 002 contain none of those and are frozen,
 * so they are safe. New migrations export an explicit string[] instead.
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
