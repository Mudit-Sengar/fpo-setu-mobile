import type { DB } from "@op-engineering/op-sqlite";

/**
 * District geography — the reference data behind every distance in the app.
 *
 * Coordinates are district headquarters, so a "distance" here is the straight
 * line between two district towns. That is approximate by construction, and
 * deliberately so: it is enough to rank a nearby FPO above a distant one, which
 * is what matching needs. It is NOT a routing estimate and should never be shown
 * as a delivery distance.
 *
 * The alternative it replaces was `60 + (fpo.id.charCodeAt(4) % 7) * 45`.
 */

interface Centroid { district: string; lat: number; lon: number }

/** Maharashtra's districts, by headquarters. */
const CENTROIDS: Centroid[] = [
  { district: "Ahmednagar", lat: 19.0948, lon: 74.7480 },
  { district: "Akola", lat: 20.7002, lon: 77.0082 },
  { district: "Amravati", lat: 20.9374, lon: 77.7796 },
  { district: "Aurangabad", lat: 19.8762, lon: 75.3433 },
  { district: "Beed", lat: 18.9891, lon: 75.7601 },
  { district: "Bhandara", lat: 21.1667, lon: 79.6500 },
  { district: "Buldhana", lat: 20.5292, lon: 76.1842 },
  { district: "Chandrapur", lat: 19.9615, lon: 79.2961 },
  { district: "Dhule", lat: 20.9042, lon: 74.7749 },
  { district: "Gadchiroli", lat: 20.1809, lon: 80.0037 },
  { district: "Gondia", lat: 21.4602, lon: 80.1920 },
  { district: "Hingoli", lat: 19.7173, lon: 77.1490 },
  { district: "Jalgaon", lat: 21.0077, lon: 75.5626 },
  { district: "Jalna", lat: 19.8410, lon: 75.8864 },
  { district: "Kolhapur", lat: 16.7050, lon: 74.2433 },
  { district: "Latur", lat: 18.4088, lon: 76.5604 },
  { district: "Mumbai", lat: 19.0760, lon: 72.8777 },
  { district: "Nagpur", lat: 21.1458, lon: 79.0882 },
  { district: "Nanded", lat: 19.1383, lon: 77.3210 },
  { district: "Nandurbar", lat: 21.3667, lon: 74.2333 },
  { district: "Nashik", lat: 19.9975, lon: 73.7898 },
  { district: "Osmanabad", lat: 18.1860, lon: 76.0419 },
  { district: "Palghar", lat: 19.6967, lon: 72.7699 },
  { district: "Parbhani", lat: 19.2704, lon: 76.7601 },
  { district: "Pune", lat: 18.5204, lon: 73.8567 },
  { district: "Raigad", lat: 18.6414, lon: 72.8722 },
  { district: "Ratnagiri", lat: 16.9902, lon: 73.3120 },
  { district: "Sangli", lat: 16.8524, lon: 74.5815 },
  { district: "Satara", lat: 17.6805, lon: 74.0183 },
  { district: "Sindhudurg", lat: 16.1300, lon: 73.6800 },
  { district: "Solapur", lat: 17.6599, lon: 75.9064 },
  { district: "Thane", lat: 19.2183, lon: 72.9781 },
  { district: "Wardha", lat: 20.7453, lon: 78.6022 },
  { district: "Washim", lat: 20.1097, lon: 77.1330 },
  { district: "Yavatmal", lat: 20.3888, lon: 78.1204 },
];

/**
 * Place names that appear in this app's free-text `location` columns but are not
 * districts — a port, a depot, a city inside a larger district.
 */
const ALIASES: { alias: string; district: string }[] = [
  { alias: "navi mumbai", district: "Raigad" },
  { alias: "jnpt", district: "Raigad" },
  { alias: "mumbai suburban", district: "Mumbai" },
  { alias: "sangamner", district: "Ahmednagar" },
  { alias: "akole", district: "Ahmednagar" },
  { alias: "rajur", district: "Ahmednagar" },
  { alias: "kotul", district: "Ahmednagar" },
  { alias: "samsherpur", district: "Ahmednagar" },
  { alias: "ausa", district: "Latur" },
  { alias: "bhusawal", district: "Jalgaon" },
  { alias: "chikhli", district: "Buldhana" },
  { alias: "parli", district: "Beed" },
  { alias: "aundha", district: "Hingoli" },
  { alias: "sinnar", district: "Nashik" },
  { alias: "junnar", district: "Pune" },
  { alias: "western maharashtra", district: "Pune" },
  { alias: "pan-maharashtra", district: "Pune" },
];

/** Great-circle distance in kilometres. */
function haversineKm(a: Centroid, b: Centroid): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Fills the centroid, alias and distance tables.
 *
 * The distance matrix is computed here rather than shipped as SQL because
 * ~35 districts means ~1,200 pairs, and a haversine in TypeScript is easier to
 * check than 1,200 literal rows. Guarded on the matrix being empty, so it costs
 * nothing after the first launch.
 */
export async function seedGeography(db: DB): Promise<void> {
  await db.transaction(async (tx) => {
    for (const c of CENTROIDS) {
      await tx.execute(
        "INSERT OR IGNORE INTO district_centroids (district, state, lat, lon) VALUES (?, 'Maharashtra', ?, ?);",
        [c.district, c.lat, c.lon]);
    }
    for (const a of ALIASES) {
      await tx.execute(
        "INSERT OR IGNORE INTO district_aliases (alias, district) VALUES (?, ?);",
        [a.alias, a.district]);
    }
  });

  const existing = await db.execute("SELECT COUNT(*) AS n FROM district_distances;");
  if (Number(existing.rows?.[0]?.n ?? 0) > 0) return;

  await db.transaction(async (tx) => {
    for (const from of CENTROIDS) {
      for (const to of CENTROIDS) {
        await tx.execute(
          "INSERT OR IGNORE INTO district_distances (from_district, to_district, km) VALUES (?, ?, ?);",
          [from.district, to.district, from.district === to.district ? 0 : haversineKm(from, to)]);
      }
    }
  });
}

/**
 * Resolves the free-text `location` on buyers and suppliers to a district.
 *
 * Candidates — district names and aliases together — are tried longest first, so
 * the most specific phrase in the text wins. That ordering matters: "JNPT, Navi
 * Mumbai" contains both the alias "navi mumbai" (Raigad, where the port is) and
 * the bare district name "Mumbai". Checking district names first put the port on
 * the wrong side of the harbour.
 *
 * Anything that matches nothing is left NULL rather than guessed — an unplaced
 * party scores neutral on distance, which is honest, where a wrong district would
 * rank them confidently in the wrong place.
 */
export async function resolveDistricts(db: DB): Promise<void> {
  const districts = ((await db.execute("SELECT district FROM district_centroids;")).rows ?? [])
    .map((r) => ({ match: String(r.district).toLowerCase(), district: String(r.district) }));
  const aliases = ((await db.execute("SELECT alias, district FROM district_aliases;")).rows ?? [])
    .map((r) => ({ match: String(r.alias).toLowerCase(), district: String(r.district) }));

  const candidates = [...aliases, ...districts]
    .sort((a, b) => b.match.length - a.match.length);

  for (const table of ["buyers", "suppliers"]) {
    const rows = (await db.execute(
      `SELECT id, location FROM ${table} WHERE district IS NULL AND location IS NOT NULL;`)).rows ?? [];

    for (const r of rows) {
      const text = String(r.location ?? "").toLowerCase();
      if (text === "") continue;

      const hit = candidates.find((c) => text.includes(c.match));
      if (hit == null) continue;

      await db.execute(
        `UPDATE ${table} SET district = ? WHERE id = ?;`, [hit.district, String(r.id)]);
    }
  }
}

/** Kilometres between two districts. Null when either is unknown. */
export async function distanceBetween(
  db: DB, from: string | null, to: string | null,
): Promise<number | null> {
  if (from == null || to == null || from === "" || to === "") return null;
  const rows = (await db.execute(
    "SELECT km FROM district_distances WHERE from_district = ? AND to_district = ?;",
    [from, to])).rows ?? [];
  return rows.length === 0 ? null : Number(rows[0].km);
}
