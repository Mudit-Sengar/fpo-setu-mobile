import { getDB } from "./connection";
import { runMigrations } from "./migrations";
import { seedIfEmpty } from "./seed";
import { ensureSupplierAccess, seedAuthIfEmpty } from "./seedAuth";
import { syncParties, syncServiceProviders } from "./parties";
import { backfillRequests } from "./requestsBackfill";
import { backfillResponses } from "./responsesBackfill";
import { backfillMemberships } from "./membershipBackfill";
import { backfillOrders, backfillReviews } from "./orderBackfill";
import { backfillConnections } from "./connectionsBackfill";
import { resolveDistricts, seedGeography } from "./geography";
import { backfillReadiness } from "./readinessBackfill";

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
    // Order matters. Migration 003 backfills `parties` for an install that already
    // has data, but on a FIRST run it executes against empty tables — the domain
    // seed above has only just filled them. These two close that gap and are
    // idempotent, so both paths end up in the same state.
    await syncServiceProviders(db);
    // Reference geography, and the districts the free-text locations resolve to.
    await seedGeography(db);
    await resolveDistricts(db);
    // Reconciling the roster can create farmers, and they need parties too.
    await backfillMemberships(db);
    await syncParties(db);
    // Needs parties, since every request has an author. Idempotent via source_ref.
    await backfillRequests(db);
    // Needs requests: replies point at postings that must already exist.
    await backfillResponses(db);
    // Needs memberships: an unpaired farmer transaction is attributed to the FPO
    // the farmer actually belongs to.
    await backfillOrders(db);
    await backfillReviews(db);
    // Needs memberships (farmer<->fpo) and reviews (fpo<->buyer) to know which
    // pairs already have a real relationship worth connecting.
    await backfillConnections(db);
    // What buyers require and what FPOs have, from the columns that implied them.
    await backfillReadiness(db);
    // After parties exist: profile links point at parties, not at entity rows.
    await seedAuthIfEmpty(db);
    // Tops up an existing install that predates the supplier role.
    await ensureSupplierAccess(db);
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
import * as requestRepo from "./repositories/requestRepository";
import * as networkRepo from "./repositories/networkRepository";
import * as membershipRepo from "./repositories/membershipRepository";
import * as orderRepo from "./repositories/orderRepository";
import * as reviewRepo from "./repositories/reviewRepository";
import * as readinessRepo from "./repositories/readinessRepository";
import * as serviceRepo from "./repositories/serviceRepository";
import * as adminRepo from "./repositories/adminRepository";
import * as auditRepo from "./repositories/auditRepository";

export {
  fpoRepo, farmerRepo, marketRepo, contentRepo, authRepo,
  requestRepo, networkRepo, membershipRepo, orderRepo, reviewRepo, readinessRepo,
  serviceRepo, adminRepo, auditRepo,
};
