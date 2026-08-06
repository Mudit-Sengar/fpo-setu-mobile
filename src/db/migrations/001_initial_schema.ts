/**
 * Migration 001 — initial schema.
 *
 * Mirrors the entity shapes that used to live as hardcoded arrays in
 * src/lib/mockData.ts (plus the inline arrays found in LearnScreen, MyFpoScreen,
 * FarmerProfileScreen and BuyerHomeScreen). Array-valued fields on the old types
 * (e.g. FPO.commodities: string[]) are normalised into child tables.
 *
 * Migrations are append-only: never edit this file after it has shipped, add 002.
 */
export const MIGRATION_001 = `
-- ============================ FPOs ============================
CREATE TABLE IF NOT EXISTS fpos (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  district              TEXT,
  block                 TEXT,
  reg_no                TEXT,
  members               INTEGER NOT NULL DEFAULT 0,
  tier                  TEXT,
  tagline               TEXT,
  warehouse_mt          INTEGER NOT NULL DEFAULT 0,
  processing_has        INTEGER NOT NULL DEFAULT 0,
  processing_type       TEXT,
  avg_price_realisation REAL,
  apmc_price            REAL,
  compliance_score      INTEGER,
  reputation            REAL,
  reviews               INTEGER,
  incorporated          TEXT
);

CREATE TABLE IF NOT EXISTS fpo_commodities (
  fpo_id    TEXT NOT NULL REFERENCES fpos(id) ON DELETE CASCADE,
  commodity TEXT NOT NULL,
  PRIMARY KEY (fpo_id, commodity)
);

CREATE TABLE IF NOT EXISTS fpo_grades (
  fpo_id TEXT NOT NULL REFERENCES fpos(id) ON DELETE CASCADE,
  grade  TEXT NOT NULL,
  PRIMARY KEY (fpo_id, grade)
);

CREATE TABLE IF NOT EXISTS fpo_supply (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  fpo_id         TEXT NOT NULL REFERENCES fpos(id) ON DELETE CASCADE,
  commodity      TEXT NOT NULL,
  qty_mt         REAL NOT NULL,
  grade          TEXT,
  harvest_window TEXT
);
CREATE INDEX IF NOT EXISTS idx_fpo_supply_fpo ON fpo_supply(fpo_id);

CREATE TABLE IF NOT EXISTS fpo_cropwise (
  fpo_id TEXT NOT NULL REFERENCES fpos(id) ON DELETE CASCADE,
  crop   TEXT NOT NULL,
  acres  REAL NOT NULL,
  PRIMARY KEY (fpo_id, crop)
);

-- Was: hardcoded monthSold/sellPrice/onwardPrice/fpoProfit in MyFpoScreen.tsx.
CREATE TABLE IF NOT EXISTS fpo_monthly_summary (
  fpo_id        TEXT PRIMARY KEY REFERENCES fpos(id) ON DELETE CASCADE,
  month_sold_q  REAL NOT NULL,
  sell_price    REAL NOT NULL,
  onward_price  REAL NOT NULL,
  fpo_profit    REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS fpo_meetings (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  fpo_id TEXT REFERENCES fpos(id) ON DELETE CASCADE,
  date   TEXT NOT NULL,
  time   TEXT,
  agenda TEXT,
  venue  TEXT
);
CREATE INDEX IF NOT EXISTS idx_fpo_meetings_fpo ON fpo_meetings(fpo_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  fpo_id          TEXT REFERENCES fpos(id) ON DELETE CASCADE,
  date            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK (type IN ('Income','Expense')),
  amount          REAL NOT NULL,
  balance         REAL NOT NULL,
  counterparty_id TEXT,
  ref_id          TEXT
);
CREATE INDEX IF NOT EXISTS idx_ledger_fpo ON ledger_entries(fpo_id);

-- ============================ Farmers ============================
CREATE TABLE IF NOT EXISTS farmers (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  village      TEXT,
  district     TEXT,
  land_acres   REAL,
  fpo_id       TEXT REFERENCES fpos(id) ON DELETE SET NULL,
  share_pct    REAL,
  member_since TEXT,
  -- Was: dummy AgriStack fields hardcoded in FarmerProfileScreen.tsx.
  taluka       TEXT,
  state        TEXT,
  survey_no    TEXT,
  khasra_no    TEXT
);
CREATE INDEX IF NOT EXISTS idx_farmers_fpo ON farmers(fpo_id);

CREATE TABLE IF NOT EXISTS farmer_crops (
  farmer_id TEXT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  crop      TEXT NOT NULL,
  PRIMARY KEY (farmer_id, crop)
);

CREATE TABLE IF NOT EXISTS farmer_txns (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  farmer_id TEXT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  date      TEXT NOT NULL,
  crop      TEXT,
  qty_q     REAL,
  price     REAL,
  amount    REAL,
  ref_id    TEXT
);
CREATE INDEX IF NOT EXISTS idx_farmer_txns_farmer ON farmer_txns(farmer_id);

CREATE TABLE IF NOT EXISTS member_engagement (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  fpo_id            TEXT REFERENCES fpos(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  village           TEXT,
  status            TEXT NOT NULL CHECK (status IN ('Active','At-risk','Dormant')),
  sold_through_fpo  REAL NOT NULL DEFAULT 0,
  trainings         INTEGER NOT NULL DEFAULT 0,
  last_txn          TEXT
);
CREATE INDEX IF NOT EXISTS idx_member_engagement_status ON member_engagement(status);

-- ============================ Buyers / Suppliers ============================
CREATE TABLE IF NOT EXISTS buyers (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  type               TEXT,
  category           TEXT,
  typical_volume_mt  REAL,
  location           TEXT,
  quality_specs      TEXT,
  procurement_window TEXT
);

CREATE TABLE IF NOT EXISTS buyer_commodities (
  buyer_id  TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  commodity TEXT NOT NULL,
  PRIMARY KEY (buyer_id, commodity)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  brand           TEXT,
  products        TEXT,
  price_range     TEXT,
  certifications  TEXT,
  regions         TEXT,
  min_order       TEXT,
  lead_time_days  INTEGER,
  seasons         TEXT,
  location        TEXT
);

CREATE TABLE IF NOT EXISTS supplier_categories (
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  PRIMARY KEY (supplier_id, category)
);

CREATE TABLE IF NOT EXISTS supplier_postings (
  id             TEXT PRIMARY KEY,
  supplier_id    TEXT REFERENCES suppliers(id) ON DELETE CASCADE,
  item           TEXT NOT NULL,
  category       TEXT,
  qty            TEXT,
  price_per_unit TEXT,
  region         TEXT,
  window         TEXT
);

-- Buyer-posted demands / supplier-posted supplies.
-- Replaces the AsyncStorage JSON blobs in src/lib/buyer-storage.ts.
CREATE TABLE IF NOT EXISTS demands (
  id         TEXT PRIMARY KEY,
  commodity  TEXT NOT NULL,
  qty_mt     REAL NOT NULL DEFAULT 0,
  grade      TEXT,
  delivery   TEXT,
  location   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplies (
  id             TEXT PRIMARY KEY,
  item           TEXT NOT NULL,
  category       TEXT,
  qty            TEXT,
  price_per_unit TEXT,
  region         TEXT,
  window         TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Was: local-only useState in BuyerReviewsScreen.tsx (never persisted at all).
CREATE TABLE IF NOT EXISTS reviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id     TEXT NOT NULL,
  target_type   TEXT NOT NULL CHECK (target_type IN ('fpo','supplier')),
  quality       INTEGER,
  delivery      INTEGER,
  communication INTEGER,
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);

CREATE TABLE IF NOT EXISTS seller_feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  fpo_id     TEXT REFERENCES fpos(id) ON DELETE CASCADE,
  buyer      TEXT NOT NULL,
  commodity  TEXT,
  qty_mt     REAL,
  date       TEXT,
  stars      INTEGER,
  note       TEXT
);

-- ============================ Partners / services ============================
CREATE TABLE IF NOT EXISTS lenders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  eligibility TEXT,
  product     TEXT
);

CREATE TABLE IF NOT EXISTS logistics_providers (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  svc      TEXT,
  location TEXT,
  phone    TEXT,
  email    TEXT
);

CREATE TABLE IF NOT EXISTS compliance_partners (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  svc  TEXT,
  fee  TEXT
);

CREATE TABLE IF NOT EXISTS compliance_explainer (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  title  TEXT NOT NULL,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS experts (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL,
  role  TEXT,
  note  TEXT,
  phone TEXT,
  email TEXT
);

CREATE TABLE IF NOT EXISTS mentors (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  expertise TEXT,
  org       TEXT,
  phone     TEXT,
  email     TEXT
);

CREATE TABLE IF NOT EXISTS input_needs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  fpo_id   TEXT REFERENCES fpos(id) ON DELETE CASCADE,
  item     TEXT NOT NULL,
  category TEXT,
  qty      TEXT,
  window   TEXT,
  notes    TEXT
);

-- ============================ Schemes ============================
CREATE TABLE IF NOT EXISTS schemes_fpo (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE,
  body           TEXT NOT NULL,
  description    TEXT,
  eligibility    TEXT,
  min_members    INTEGER,
  min_compliance INTEGER
);

CREATE TABLE IF NOT EXISTS scheme_fpo_eligible_tiers (
  scheme_id INTEGER NOT NULL REFERENCES schemes_fpo(id) ON DELETE CASCADE,
  tier      TEXT NOT NULL,
  PRIMARY KEY (scheme_id, tier)
);

CREATE TABLE IF NOT EXISTS schemes_farmer (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  body        TEXT NOT NULL,
  description TEXT,
  benefit     TEXT,
  url         TEXT
);

CREATE TABLE IF NOT EXISTS farmer_scheme_requirements (
  scheme_id   INTEGER NOT NULL REFERENCES schemes_farmer(id) ON DELETE CASCADE,
  requirement TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_farmer_scheme_req ON farmer_scheme_requirements(scheme_id);

-- ============================ Learning content ============================
-- category: 'farmer' (FARMER_COURSES) | 'value' (VALUE_COURSES) | 'mgmt' (MGMT_COURSES)
CREATE TABLE IF NOT EXISTS courses (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  category  TEXT NOT NULL,
  name      TEXT NOT NULL,
  by        TEXT,
  progress  INTEGER NOT NULL DEFAULT 0,
  duration  TEXT,
  transcript TEXT,
  thumb_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);

-- Was: the local STORIES array in LearnScreen.tsx (never in mockData at all).
CREATE TABLE IF NOT EXISTS stories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  duration   TEXT,
  transcript TEXT,
  thumb_key  TEXT
);

-- ============================ Tiers / opportunities ============================
CREATE TABLE IF NOT EXISTS tier_scores (
  tier        TEXT PRIMARY KEY,
  financial   INTEGER NOT NULL,
  operational INTEGER NOT NULL,
  infra       INTEGER NOT NULL,
  governance  INTEGER NOT NULL,
  market      INTEGER NOT NULL
);

-- Replaces the ~100-line tierOpportunities() if/else in mockData.ts.
CREATE TABLE IF NOT EXISTS tier_opportunities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tier       TEXT NOT NULL,
  label      TEXT NOT NULL,
  amount     TEXT,
  action     TEXT,
  investment TEXT,
  outcome    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tier_opps_tier ON tier_opportunities(tier);

CREATE TABLE IF NOT EXISTS tier_opportunity_steps (
  opportunity_id INTEGER NOT NULL REFERENCES tier_opportunities(id) ON DELETE CASCADE,
  step           TEXT NOT NULL,
  sort_order     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tier_opp_steps ON tier_opportunity_steps(opportunity_id);

-- ============================ Market data ============================
CREATE TABLE IF NOT EXISTS daily_apmc_prices (
  crop  TEXT NOT NULL,
  date  TEXT NOT NULL,
  price REAL NOT NULL,
  PRIMARY KEY (crop, date)
);
CREATE INDEX IF NOT EXISTS idx_apmc_crop_date ON daily_apmc_prices(crop, date);

CREATE TABLE IF NOT EXISTS price_history (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  fpo   REAL,
  apmc  REAL
);

CREATE TABLE IF NOT EXISTS farmer_buyer_matches (
  id          TEXT PRIMARY KEY,
  buyer       TEXT NOT NULL,
  crop        TEXT,
  grade       TEXT,
  qty         TEXT,
  window      TEXT,
  location    TEXT,
  distance_km REAL
);

CREATE TABLE IF NOT EXISTS similar_farmers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  village     TEXT,
  district    TEXT,
  crop        TEXT,
  grade       TEXT,
  quality     TEXT,
  land_acres  REAL,
  distance_km REAL
);

-- ============================ Lookups ============================
-- Reference lists that were duplicated inline across BuyerHomeScreen,
-- BuyerMatchingScreen and ConnectScreen.
CREATE TABLE IF NOT EXISTS lookup_values (
  kind       TEXT NOT NULL,
  value      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, value)
);
CREATE INDEX IF NOT EXISTS idx_lookup_kind ON lookup_values(kind);
`;
