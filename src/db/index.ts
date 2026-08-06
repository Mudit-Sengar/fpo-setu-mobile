import { getDB } from "./connection";
import { runMigrations } from "./migrations";
import { seedIfEmpty } from "./seed";
import { seedAuthIfEmpty } from "./seedAuth";

/**
 * Public entry point for the data layer.
 *
 * Screens import from `src/db/repositories/*` (or the re-exports below) — never
 * from @op-engineering/op-sqlite directly, so all SQL stays inside src/db/.
 */

export { DbError } from "./connection";
export * from "./types";

let initPromise: Promise<void> | null = null;

/**
 * Opens the database, applies pending migrations, and seeds it on first run.
 * Idempotent and safe to call from several places — the work happens once.
 */
export function initDatabase(): Promise<void> {
  initPromise ??= (async () => {
    const db = getDB();
    await runMigrations(db);
    await seedIfEmpty(db);
    // After the domain seed: the profile links reference farmers/fpos/buyers rows.
    await seedAuthIfEmpty(db);
  })();
  return initPromise;
}

// NB: `export * as ns from "..."` needs @babel/plugin-transform-export-namespace-from,
// which RN's Babel preset doesn't ship — import-then-export instead.
import * as fpoRepo from "./repositories/fpoRepository";
import * as farmerRepo from "./repositories/farmerRepository";
import * as marketRepo from "./repositories/marketRepository";
import * as contentRepo from "./repositories/contentRepository";
import * as authRepo from "./repositories/authRepository";

export { fpoRepo, farmerRepo, marketRepo, contentRepo, authRepo };
