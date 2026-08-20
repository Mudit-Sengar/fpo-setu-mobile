/**
 * Migration 010 — geography.
 *
 * Distance in this app was `60 + (fpo.id.charCodeAt(4) % 7) * 45` — a number
 * derived from a character of an id string, used to filter FPOs out of a buyer's
 * results. Phase 3 removed the filter rather than keep rejecting real FPOs on
 * invented grounds; this replaces it with something true.
 *
 * A precomputed matrix rather than haversine at query time: SQLite has no
 * trigonometric functions, ~36 Maharashtra districts is about 1,300 rows, and a
 * lookup is both faster and orderable in SQL. The distances are between district
 * headquarters, so they are approximate by construction — good enough to rank a
 * nearby FPO above a distant one, not a routing estimate.
 *
 * `similar_farmers` and `farmer_buyer_matches` are dropped here. Both were tables
 * of invented rows that nothing has read since Phases 4 and 3 respectively.
 */
export const MIGRATION_010: string[] = [
  `CREATE TABLE IF NOT EXISTS district_centroids (
    district TEXT PRIMARY KEY,
    state    TEXT NOT NULL,
    lat      REAL NOT NULL,
    lon      REAL NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS district_distances (
    from_district TEXT NOT NULL REFERENCES district_centroids(district) ON DELETE CASCADE,
    to_district   TEXT NOT NULL REFERENCES district_centroids(district) ON DELETE CASCADE,
    km            REAL NOT NULL,
    PRIMARY KEY (from_district, to_district)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_district_distances_to ON district_distances(to_district, km);`,

  // Free-text locations that name a place rather than a district, so the seeded
  // buyers and suppliers can be placed on the map. Reference data, not user data.
  `CREATE TABLE IF NOT EXISTS district_aliases (
    alias    TEXT PRIMARY KEY,
    district TEXT NOT NULL REFERENCES district_centroids(district) ON DELETE CASCADE
  );`,

  /* --------------------------------------- retire the two invented tables -- */
  // Promotion runs HERE, immediately before the drop, rather than as a launch
  // step. A launch step would be ordered after migrations and would therefore
  // find the table already gone — the peers would be silently lost on the one
  // upgrade that was supposed to rescue them.
  //
  // On a fresh install these promote nothing, because migrations precede the
  // seed; there the peers are seeded directly as farmers (see src/db/seed.ts).
  `INSERT OR IGNORE INTO farmers (id, name, village, district, land_acres, state)
     SELECT id, name, village, district, land_acres, 'Maharashtra' FROM similar_farmers;`,
  `INSERT OR IGNORE INTO farmer_crops (farmer_id, crop)
     SELECT id, crop FROM similar_farmers WHERE crop IS NOT NULL AND crop <> '';`,
  `INSERT OR IGNORE INTO parties (kind, entity_id)
     SELECT 'farmer', id FROM similar_farmers;`,

  // Nothing has read either of these since the phases that replaced them: peer
  // farmers became real `farmers` rows, and farmer-to-buyer matching became a
  // query over open `requests`.
  `DROP TABLE IF EXISTS similar_farmers;`,
  `DROP TABLE IF EXISTS farmer_buyer_matches;`,
];
