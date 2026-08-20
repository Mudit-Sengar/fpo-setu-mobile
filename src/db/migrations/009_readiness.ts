/**
 * Migration 009 — what buyers require, and what FPOs have.
 *
 * The Buyer Readiness & Market Qualification form collects around thirty fields
 * across four accordions: commodities, geographies, seasons, moisture and foreign
 * matter limits, certifications, infrastructure, compliance. Every one of them
 * lived in `useState` inside a throwaway sub-component that the parent never
 * read, so pressing "Save & Find Matching FPOs" navigated and discarded the lot.
 * It is the richest matching signal in the app and none of it survived the tap.
 *
 * These tables are the other half of that: what a buyer needs, what an FPO has,
 * and the comparison between them. Once both sides are stored, "62% ready" stops
 * being a constant and becomes a count of requirements met.
 */
export const MIGRATION_009: string[] = [
  /* -------------------------------------------------- buyer requirements -- */
  `CREATE TABLE IF NOT EXISTS buyer_requirements (
    buyer_id                     TEXT PRIMARY KEY REFERENCES buyers(id) ON DELETE CASCADE,
    quantity                     REAL,
    unit                         TEXT,
    moisture_max                 REAL,
    foreign_matter_max           REAL,
    grading_standard             TEXT,
    packaging_standard           TEXT,
    traceability_required        INTEGER NOT NULL DEFAULT 0,
    traceability_note            TEXT,
    residue_limits               TEXT,
    storage_capacity_required_mt REAL,
    updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // Multi-selects, each its own table rather than a comma-joined column: matching
  // has to ask "does this buyer want Onion?" and a LIKE over a string would match
  // "Onion" inside "Spring Onion".
  `CREATE TABLE IF NOT EXISTS buyer_requirement_commodities (
    buyer_id  TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    commodity TEXT NOT NULL,
    PRIMARY KEY (buyer_id, commodity)
  );`,
  `CREATE TABLE IF NOT EXISTS buyer_requirement_states (
    buyer_id TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    state    TEXT NOT NULL,
    PRIMARY KEY (buyer_id, state)
  );`,
  `CREATE TABLE IF NOT EXISTS buyer_requirement_seasons (
    buyer_id TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    season   TEXT NOT NULL,
    PRIMARY KEY (buyer_id, season)
  );`,
  `CREATE TABLE IF NOT EXISTS buyer_required_certifications (
    buyer_id      TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    certification TEXT NOT NULL,
    PRIMARY KEY (buyer_id, certification)
  );`,
  `CREATE TABLE IF NOT EXISTS buyer_required_infrastructure (
    buyer_id  TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    item      TEXT NOT NULL,
    mandatory INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (buyer_id, item)
  );`,
  `CREATE TABLE IF NOT EXISTS buyer_required_compliance (
    buyer_id  TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    item      TEXT NOT NULL,
    mandatory INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (buyer_id, item)
  );`,

  /* --------------------------------------------------- FPO capabilities -- */
  `CREATE TABLE IF NOT EXISTS fpo_infrastructure (
    fpo_id        TEXT NOT NULL REFERENCES fpos(id) ON DELETE CASCADE,
    item          TEXT NOT NULL,
    present       INTEGER NOT NULL DEFAULT 0,
    capacity_note TEXT,
    PRIMARY KEY (fpo_id, item)
  );`,
  `CREATE TABLE IF NOT EXISTS fpo_certifications (
    fpo_id        TEXT NOT NULL REFERENCES fpos(id) ON DELETE CASCADE,
    certification TEXT NOT NULL,
    issued_on     TEXT,
    expires_on    TEXT,
    document_ref  TEXT,
    PRIMARY KEY (fpo_id, certification)
  );`,
  `CREATE TABLE IF NOT EXISTS fpo_compliance (
    fpo_id TEXT NOT NULL REFERENCES fpos(id) ON DELETE CASCADE,
    item   TEXT NOT NULL,
    held   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (fpo_id, item)
  );`,

  /* ------------------------------------------------ readiness assessment -- */
  // Each run is kept rather than overwritten, so closing a gap and re-checking
  // shows movement instead of just a new number.
  `CREATE TABLE IF NOT EXISTS fpo_readiness_assessments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    fpo_id         TEXT NOT NULL REFERENCES fpos(id)   ON DELETE CASCADE,
    buyer_id       TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    crop           TEXT NOT NULL,
    score          INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    est_investment REAL NOT NULL DEFAULT 0,
    assessed_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE INDEX IF NOT EXISTS idx_readiness_fpo
     ON fpo_readiness_assessments(fpo_id, buyer_id, crop, assessed_at DESC);`,

  `CREATE TABLE IF NOT EXISTS fpo_readiness_gaps (
    assessment_id INTEGER NOT NULL REFERENCES fpo_readiness_assessments(id) ON DELETE CASCADE,
    requirement   TEXT NOT NULL,
    category      TEXT NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('met','partial','missing')),
    est_cost      REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (assessment_id, requirement)
  );`,

  /* ------------------------------------------------------------ geography */
  // Buyers and suppliers record a free-text location ("JNPT, Navi Mumbai",
  // "Pune depot"). A resolved district is what distance can be measured between.
  `ALTER TABLE buyers    ADD COLUMN district TEXT;`,
  `ALTER TABLE suppliers ADD COLUMN district TEXT;`,
];
