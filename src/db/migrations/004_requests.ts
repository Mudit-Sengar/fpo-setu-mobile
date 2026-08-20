/**
 * Migration 004 — requests and responses.
 *
 * An FPO's commodity supply, an FPO's input need, a buyer's demand and a
 * supplier's supply were four tables with four shapes, and none of them had an
 * author or a status. They are the same thing pointed in different directions:
 * somebody offers or needs a quantity of something, in a window, until it is
 * met. Collapsing them means matching is one query instead of four bespoke
 * screens, and a response can point at any of them with one foreign key.
 *
 * This migration is DDL only. The backfill from the old tables lives in
 * src/db/requestsBackfill.ts because it has to parse free-text quantities
 * ("2,000 kg", "12 units × 4 days") that SQL cannot, and because it must also
 * run after seeding on a fresh install — migrations execute before the seed, so
 * a backfill written as SQL here would see empty tables and do nothing.
 *
 * The old tables (fpo_supply, input_needs, demands, supplies, supplier_postings)
 * are deliberately NOT dropped. Nothing reads them after this phase; they stay as
 * a recovery path until the backfill has been proven on real devices, and a later
 * migration removes them.
 */
export const MIGRATION_004: string[] = [
  `CREATE TABLE IF NOT EXISTS requests (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    author_party_id   INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    kind              TEXT NOT NULL CHECK (kind IN
                        ('commodity_supply','commodity_demand','input_supply','input_demand')),
    item              TEXT NOT NULL,
    category          TEXT,
    grade             TEXT,
    -- Numeric quantity where one could be determined, plus the text the user
    -- actually typed. Commodity requests are always numeric MT; input requests
    -- are free-form in this app ("120 kg", "12 units x 4 days"), so qty_label is
    -- what gets displayed and qty is the best-effort value used for matching.
    qty               REAL NOT NULL DEFAULT 0 CHECK (qty >= 0),
    qty_label         TEXT,
    unit              TEXT NOT NULL DEFAULT 'MT'
                        CHECK (unit IN ('MT','Quintal','Kg','L','unit')),
    price_expectation REAL,
    price_unit        TEXT,
    window_label      TEXT,
    district          TEXT,
    state             TEXT,
    status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN
                        ('draft','open','matched','fulfilled','expired','cancelled')),
    visibility        TEXT NOT NULL DEFAULT 'public'
                        CHECK (visibility IN ('public','members_only','private')),
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at        TEXT,
    -- Provenance for a row carried over from a pre-004 table, e.g. 'fpo_supply:12'.
    -- UNIQUE makes the backfill idempotent; NULL for anything created since, and
    -- SQLite permits many NULLs in a UNIQUE column.
    source_ref        TEXT UNIQUE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_requests_match  ON requests(kind, status, item, grade);`,
  `CREATE INDEX IF NOT EXISTS idx_requests_author ON requests(author_party_id, status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_requests_geo    ON requests(status, district);`,

  `CREATE TABLE IF NOT EXISTS request_responses (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id         INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    responder_party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    message            TEXT,
    offered_qty        REAL,
    offered_price      REAL,
    offered_unit       TEXT,
    status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                         ('pending','accepted','rejected','withdrawn','expired')),
    responded_at       TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at         TEXT,
    decided_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    -- One response per party per request: quoting the same request twice would
    -- show the author the same counterparty in their inbox repeatedly.
    UNIQUE (request_id, responder_party_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_responses_request ON request_responses(request_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_responses_party   ON request_responses(responder_party_id, status);`,
];
