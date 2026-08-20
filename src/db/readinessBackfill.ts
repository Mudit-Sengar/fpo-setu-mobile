import type { DB } from "@op-engineering/op-sqlite";

/**
 * Gives the readiness tables a starting position from what the app already knew.
 *
 * Nothing here invents a requirement. Each row comes from a column that already
 * implied it:
 *
 *  - a buyer's `buyer_commodities` say what they buy, which is the same list the
 *    readiness form asks for under "Commodity";
 *  - `buyers.quality_specs` is free text like "Grade A, <5% moisture, traceable"
 *    and "Export grade, phyto-certified" — the numbers and words in it are the
 *    quality requirements, parsed conservatively and left NULL when absent;
 *  - `fpos.warehouse_mt` and `processing_has` are infrastructure the FPO stated.
 *
 * A buyer who has never opened the readiness form therefore still matches on
 * something real, rather than matching on nothing until they do.
 */

const str = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));

/** The infrastructure vocabulary shared by the buyer form and the FPO record. */
export const INFRASTRUCTURE_ITEMS = [
  "Warehouse",
  "Cleaning Unit",
  "Sorting Line",
  "Grading Machine",
  "Digital Record Keeping",
  "Cold Storage",
  "Testing Facility",
] as const;

export const COMPLIANCE_ITEMS = [
  "GST Registration",
  "FSSAI License",
  "Producer Company Registration",
  "Audited Financial Statements",
  "PAN",
  "Bank Account",
  "Insurance",
] as const;

export const CERTIFICATIONS = ["Organic", "Global GAP", "FSSAI", "ISO", "APEDA"] as const;

/**
 * Pulls a percentage out of quality-spec prose.
 * "<5% moisture" -> 5. Returns null when the text does not state one.
 */
function percentNear(text: string, keyword: string): number | null {
  const lower = text.toLowerCase();
  if (!lower.includes(keyword)) return null;
  // A number with an optional % sign within ~20 characters of the keyword.
  const idx = lower.indexOf(keyword);
  const window = lower.slice(Math.max(0, idx - 20), idx + 20);
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(window);
  return m == null ? null : Number(m[1]);
}

export async function backfillReadiness(db: DB): Promise<void> {
  /* ------------------------------------------------- buyers -> requirements */
  const buyers = (await db.execute(
    "SELECT id, quality_specs, typical_volume_mt, procurement_window FROM buyers;")).rows ?? [];

  for (const b of buyers) {
    const buyerId = str(b.id);
    const specs = str(b.quality_specs);
    const lower = specs.toLowerCase();

    const done = (await db.execute(
      "SELECT 1 AS ok FROM buyer_requirements WHERE buyer_id = ?;", [buyerId])).rows ?? [];
    if (done.length === 0) {
      await db.execute(
        `INSERT INTO buyer_requirements
           (buyer_id, quantity, unit, moisture_max, foreign_matter_max,
            grading_standard, traceability_required)
         VALUES (?,?,'MT',?,?,?,?);`,
        [buyerId, Number(b.typical_volume_mt ?? 0) || null,
          percentNear(specs, "moisture"),
          percentNear(specs, "foreign matter"),
          // "Grade A" / "Sortex" / "Export grade" appear verbatim in the specs.
          lower.includes("export") ? "Export"
            : lower.includes("sortex") ? "Sortex"
              : lower.includes("grade a") ? "Grade A" : null,
          lower.includes("traceab") ? 1 : 0]);
    }

    // What they buy is what they require.
    await db.execute(
      `INSERT OR IGNORE INTO buyer_requirement_commodities (buyer_id, commodity)
         SELECT buyer_id, commodity FROM buyer_commodities WHERE buyer_id = ?;`, [buyerId]);

    // Certifications named in the spec text, and only those.
    for (const cert of CERTIFICATIONS) {
      const named = lower.includes(cert.toLowerCase())
        || (cert === "APEDA" && lower.includes("phyto"));
      if (named) {
        await db.execute(
          "INSERT OR IGNORE INTO buyer_required_certifications (buyer_id, certification) VALUES (?, ?);",
          [buyerId, cert]);
      }
    }
  }

  /* -------------------------------------------------- fpos -> capabilities */
  const fpos = (await db.execute(
    "SELECT id, warehouse_mt, processing_has, processing_type, compliance_score FROM fpos;")).rows ?? [];

  for (const f of fpos) {
    const fpoId = str(f.id);
    const warehouseMt = Number(f.warehouse_mt ?? 0);
    const processing = Number(f.processing_has ?? 0) === 1;
    const processingType = str(f.processing_type).toLowerCase();

    const seeded = (await db.execute(
      "SELECT 1 AS ok FROM fpo_infrastructure WHERE fpo_id = ? LIMIT 1;", [fpoId])).rows ?? [];
    if (seeded.length > 0) continue;

    // Derived only from what the FPO row actually states. Anything the record is
    // silent about starts absent, which is the honest default — an FPO can mark
    // it present from its own profile screen.
    const present: Record<string, boolean> = {
      "Warehouse": warehouseMt > 0,
      "Cleaning Unit": processing && /grad|sortex|clean/.test(processingType),
      "Sorting Line": processing && /grad|sortex|sort/.test(processingType),
      "Grading Machine": processing && /grad|sortex/.test(processingType),
      "Digital Record Keeping": false,
      "Cold Storage": processing && /cold|ripen/.test(processingType),
      "Testing Facility": false,
    };

    for (const item of INFRASTRUCTURE_ITEMS) {
      await db.execute(
        `INSERT OR IGNORE INTO fpo_infrastructure (fpo_id, item, present, capacity_note)
         VALUES (?,?,?,?);`,
        [fpoId, item, present[item] ? 1 : 0,
          item === "Warehouse" && warehouseMt > 0 ? `${warehouseMt} MT` : null]);
    }

    // Compliance score is a percentage of a checklist the app never itemised.
    // Rather than invent which items an FPO holds, the registration items every
    // registered producer company necessarily has are marked held, and the rest
    // start unknown.
    const baseline = ["Producer Company Registration", "PAN", "Bank Account"];
    for (const item of COMPLIANCE_ITEMS) {
      await db.execute(
        "INSERT OR IGNORE INTO fpo_compliance (fpo_id, item, held) VALUES (?,?,?);",
        [fpoId, item, baseline.includes(item) ? 1 : 0]);
    }
  }
}
