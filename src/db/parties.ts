import type { DB } from "@op-engineering/op-sqlite";

/**
 * Keeps `parties` in step with the entity tables.
 *
 * Migration 003 backfills parties for an install that already has data, but on a
 * FIRST run the migration executes against empty tables — seeding happens after.
 * This runs on every launch, after seeding, so both paths converge on the same
 * state and any entity added later (by a seed top-up, or eventually by a user)
 * picks up its party row without another migration.
 *
 * Every statement is INSERT OR IGNORE against the UNIQUE (kind, entity_id) index,
 * so re-running can never produce a second party for one entity — which would
 * split that entity's connections, orders and reputation across two identities.
 */
const SYNC: string[] = [
  "INSERT OR IGNORE INTO parties (kind, entity_id) SELECT 'farmer',           id FROM farmers;",
  "INSERT OR IGNORE INTO parties (kind, entity_id) SELECT 'fpo',              id FROM fpos;",
  "INSERT OR IGNORE INTO parties (kind, entity_id) SELECT 'buyer',            id FROM buyers;",
  "INSERT OR IGNORE INTO parties (kind, entity_id) SELECT 'supplier',         id FROM suppliers;",
  "INSERT OR IGNORE INTO parties (kind, entity_id) SELECT 'service_provider', id FROM service_providers;",
];

export async function syncParties(db: DB): Promise<void> {
  await db.transaction(async (tx) => {
    for (const statement of SYNC) {
      await tx.execute(statement);
    }
  });
}

/**
 * Populates `service_providers` from the five legacy directories.
 *
 * Same first-run problem as parties: migration 003's backfill sees empty tables
 * on a fresh install. Keyed on prefixed ids so it is idempotent.
 */
const PROVIDERS: string[] = [
  `INSERT OR IGNORE INTO service_providers (id, name, provider_type, product_note, eligibility_note)
     SELECT 'sp-lender-' || id, name, 'lender', product, eligibility FROM lenders;`,
  `INSERT OR IGNORE INTO service_providers (id, name, provider_type, specialisation, location, phone, email)
     SELECT 'sp-logistics-' || id, name, 'logistics', svc, location, phone, email FROM logistics_providers;`,
  `INSERT OR IGNORE INTO service_providers (id, name, provider_type, specialisation, fee_note)
     SELECT 'sp-compliance-' || id, name, 'compliance', svc, fee FROM compliance_partners;`,
  `INSERT OR IGNORE INTO service_providers (id, name, provider_type, specialisation, note, phone, email)
     SELECT 'sp-expert-' || id, name, 'expert', role, note, phone, email FROM experts;`,
  `INSERT OR IGNORE INTO service_providers (id, name, provider_type, specialisation, org, phone, email)
     SELECT 'sp-mentor-' || id, name, 'mentor', expertise, org, phone, email FROM mentors;`,
];

export async function syncServiceProviders(db: DB): Promise<void> {
  await db.transaction(async (tx) => {
    for (const statement of PROVIDERS) {
      await tx.execute(statement);
    }
  });
}

/*
 * NOTE: promotePeerFarmers() used to live here, turning `similar_farmers` rows
 * into real farmers on every launch. It moved into migration 010, which runs it
 * once and then drops that table — a launch step is ordered after migrations, so
 * it would have found the table already gone.
 */
