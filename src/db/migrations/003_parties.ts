/**
 * Migration 003 — the party supertype.
 *
 * Farmers, FPOs, buyers and suppliers live in four tables with four unrelated id
 * formats ("MH-AH-2024-00831", "fpo-1", "b-1", "s-1"). Nothing could express
 * "A did something to B" because there was no type meaning "A or B" — so every
 * cross-persona action in the app ended in a toast instead of a row.
 *
 * `parties` is that type: one row per actor, with a real integer primary key that
 * later relationship tables (connections, requests, orders, reviews, messages)
 * can foreign-key to. The existing text ids are untouched and stay the natural
 * key of each entity — `parties` is a thin identity map layered over them, not a
 * replacement.
 *
 * Names and locations are deliberately NOT copied into `parties`. The v_parties
 * view resolves them from the owning entity on read, so there is exactly one
 * source of truth for a name.
 *
 * Also here:
 *  - `user_profiles` replaces farmer_profiles / fpo_profiles / buyer_profiles with
 *    one table keyed by (user_id, role_code) pointing at a party. That is what
 *    lets `supplier` become a role without a fourth near-identical join table.
 *  - `service_providers` folds the five ID-less directories (lenders, logistics,
 *    compliance partners, experts, mentors) into one entity that can hold a party
 *    row, so a future "Apply" / "Request service" has something to point at.
 *
 * Statements are an explicit array, not a semicolon-split blob — the v_parties
 * view would not survive the old splitter.
 */
export const MIGRATION_003: string[] = [
  /* ------------------------------------------------------------- parties -- */
  `CREATE TABLE IF NOT EXISTS parties (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL CHECK (kind IN ('farmer','fpo','buyer','supplier','service_provider')),
    entity_id  TEXT NOT NULL,
    is_active  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (kind, entity_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_parties_entity ON parties(kind, entity_id);`,

  /* --------------------------------------------------- service providers -- */
  // Absorbs lenders / logistics_providers / compliance_partners / experts /
  // mentors. Those tables are left in place and are still what contentRepository
  // reads today; the reads move over when service requests land.
  `CREATE TABLE IF NOT EXISTS service_providers (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    provider_type    TEXT NOT NULL CHECK (provider_type IN ('lender','logistics','compliance','expert','mentor')),
    org              TEXT,
    specialisation   TEXT,
    phone            TEXT,
    email            TEXT,
    location         TEXT,
    fee_note         TEXT,
    eligibility_note TEXT,
    product_note     TEXT,
    note             TEXT,
    is_active        INTEGER NOT NULL DEFAULT 1
  );`,

  `CREATE INDEX IF NOT EXISTS idx_service_providers_type ON service_providers(provider_type);`,

  /* ------------------------------------------------------ user profiles -- */
  // PRIMARY KEY (user_id, role_code) keeps "at most one profile per login per
  // role". party_id is RESTRICT rather than CASCADE: deleting an entity that a
  // login depends on should fail loudly, not silently strand the account.
  `CREATE TABLE IF NOT EXISTS user_profiles (
    user_id    INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    role_code  TEXT    NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
    party_id   INTEGER NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    is_primary INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, role_code)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_user_profiles_party ON user_profiles(party_id);`,

  /* -------------------------------------------------------------- roles -- */
  // Supplier was never a role — it was a useState toggle inside the Buyer view,
  // so every supplier screen edited whichever row sorted first. Seeding it here
  // rather than in seedAuth.ts because seedAuth is guarded on `users` being
  // empty and would never run again on an existing install.
  `INSERT OR IGNORE INTO roles (code, label, sort_order) VALUES ('supplier', 'Supplier', 4);`,
  `UPDATE roles SET sort_order = 5 WHERE code = 'admin';`,

  /* --------------------------------------------------- backfill: parties -- */
  // INSERT OR IGNORE against the UNIQUE (kind, entity_id) makes each of these
  // idempotent, so a re-run can never split one entity across two party rows.
  `INSERT OR IGNORE INTO parties (kind, entity_id) SELECT 'farmer',   id FROM farmers;`,
  `INSERT OR IGNORE INTO parties (kind, entity_id) SELECT 'fpo',      id FROM fpos;`,
  `INSERT OR IGNORE INTO parties (kind, entity_id) SELECT 'buyer',    id FROM buyers;`,
  `INSERT OR IGNORE INTO parties (kind, entity_id) SELECT 'supplier', id FROM suppliers;`,

  /* ----------------------------------------- backfill: service providers -- */
  // The five source tables use INTEGER AUTOINCREMENT ids that collide across
  // tables, so each row gets a prefixed stable text id.
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

  `INSERT OR IGNORE INTO parties (kind, entity_id) SELECT 'service_provider', id FROM service_providers;`,

  /* --------------------------------------------- backfill: user_profiles -- */
  // Existing links are carried over by resolving each entity id to its party.
  `INSERT OR IGNORE INTO user_profiles (user_id, role_code, party_id)
     SELECT fp.user_id, 'farmer', p.id
       FROM farmer_profiles fp
       JOIN parties p ON p.kind = 'farmer' AND p.entity_id = fp.farmer_id;`,

  `INSERT OR IGNORE INTO user_profiles (user_id, role_code, party_id)
     SELECT op.user_id, 'fpo', p.id
       FROM fpo_profiles op
       JOIN parties p ON p.kind = 'fpo' AND p.entity_id = op.fpo_id;`,

  `INSERT OR IGNORE INTO user_profiles (user_id, role_code, party_id)
     SELECT bp.user_id, 'buyer', p.id
       FROM buyer_profiles bp
       JOIN parties p ON p.kind = 'buyer' AND p.entity_id = bp.buyer_id;`,

  /* --------------------------------------------------- retire old tables -- */
  // Nothing else references these, and leaving them would mean two places to keep
  // a profile link in sync. Everything above has already been copied across.
  `DROP TABLE IF EXISTS farmer_profiles;`,
  `DROP TABLE IF EXISTS fpo_profiles;`,
  `DROP TABLE IF EXISTS buyer_profiles;`,

  /* ---------------------------------------------------------- directory -- */
  // One queryable directory of every actor, with zero duplicated names. `locality`
  // rather than `district` because buyers and suppliers store a free-text
  // location ("JNPT, Navi Mumbai", "Pune depot"), not a district — calling it
  // district would invite a join that silently matches nothing.
  `CREATE VIEW IF NOT EXISTS v_parties AS
     SELECT p.id AS party_id, p.kind AS kind, p.entity_id AS entity_id,
            f.name AS name, f.district AS locality, f.state AS state
       FROM parties p JOIN farmers f ON p.kind = 'farmer' AND f.id = p.entity_id
     UNION ALL
     SELECT p.id, p.kind, p.entity_id, o.name, o.district, NULL
       FROM parties p JOIN fpos o ON p.kind = 'fpo' AND o.id = p.entity_id
     UNION ALL
     SELECT p.id, p.kind, p.entity_id, b.name, b.location, NULL
       FROM parties p JOIN buyers b ON p.kind = 'buyer' AND b.id = p.entity_id
     UNION ALL
     SELECT p.id, p.kind, p.entity_id, s.name, s.location, NULL
       FROM parties p JOIN suppliers s ON p.kind = 'supplier' AND s.id = p.entity_id
     UNION ALL
     SELECT p.id, p.kind, p.entity_id, v.name, v.location, NULL
       FROM parties p JOIN service_providers v ON p.kind = 'service_provider' AND v.id = p.entity_id;`,
];
