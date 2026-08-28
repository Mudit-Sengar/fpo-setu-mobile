import type { DB } from "@op-engineering/op-sqlite";

/**
 * Gives the readiness tables a starting position from what the app already knew.
 *
 * The six buyers seeded with the app (`CURATED_REQUIREMENTS` below) get an
 * explicit, realistic requirement set — several distinct items each, so that a
 * readiness assessment has more than one thing to be partly right about. Every
 * other buyer — one an administrator adds later, or one that fills its own
 * Buyer Readiness form — is derived conservatively from columns that already
 * implied a requirement, same as before this map existed:
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

interface CuratedRequirement {
  quantity: number | null;
  unit: string;
  moistureMax: number | null;
  foreignMatterMax: number | null;
  gradingStandard: string | null;
  packagingStandard: string;
  traceabilityRequired: boolean;
  traceabilityNote: string;
  residueLimits: string;
  storageCapacityRequiredMt: number | null;
  states: string[];
  seasons: string[];
  certifications: string[];
  infrastructure: string[];
  compliance: string[];
}

/**
 * What each seeded buyer actually requires, spelled out rather than guessed at
 * from `quality_specs` prose.
 *
 * The keyword parser below this still runs for any buyer not listed here — an
 * administrator adding a new buyer through the Buyers section on Admin, or a
 * buyer signing in and filling their own form, needs nothing added here to be
 * matched against. This map exists so the six buyers seeded with the app start
 * with more than one FPO can ever satisfy in full — a buyer who only ever needed
 * one thing was never a very useful demonstration that matching works per
 * requirement, per buyer, independently.
 */
const CURATED_REQUIREMENTS: Record<string, CuratedRequirement> = {
  "b-1": { // Sahyadri Foods — Processor, Nashik. Grade A, traceable, mid-scale.
    quantity: 800, unit: "MT", moistureMax: 5, foreignMatterMax: 2,
    gradingStandard: "Grade A", packagingStandard: "50 kg HDPE woven bags, lot-coded",
    traceabilityRequired: true, traceabilityNote: "Farm-to-FPO lot traceability with QR code",
    residueLimits: "", storageCapacityRequiredMt: 100,
    states: ["Maharashtra"], seasons: ["Rabi", "Kharif"],
    certifications: ["FSSAI"],
    infrastructure: ["Warehouse", "Sorting Line", "Grading Machine"],
    compliance: ["GST Registration", "FSSAI License"],
  },
  "b-2": { // FreshKart Retail — Modern Retail, Mumbai. Cold-chain, year-round.
    quantity: 500, unit: "MT", moistureMax: null, foreignMatterMax: 1,
    gradingStandard: "Grade A", packagingStandard: "Ventilated plastic crates, cold-chain handling",
    traceabilityRequired: true, traceabilityNote: "Batch-level cold-chain tracking to store delivery",
    residueLimits: "", storageCapacityRequiredMt: 50,
    states: ["Maharashtra"], seasons: ["Year-round"],
    certifications: [],
    infrastructure: ["Cold Storage", "Sorting Line", "Digital Record Keeping"],
    compliance: ["GST Registration", "FSSAI License", "Bank Account"],
  },
  "b-3": { // Pune Wholesale Mandi Traders — Wholesaler, Pune. High volume, spot.
    quantity: 1500, unit: "MT", moistureMax: null, foreignMatterMax: null,
    gradingStandard: null, packagingStandard: "Mandi-standard jute or HDPE sacks",
    traceabilityRequired: false, traceabilityNote: "",
    residueLimits: "", storageCapacityRequiredMt: 200,
    states: ["Maharashtra"], seasons: ["Rabi"],
    certifications: [],
    infrastructure: ["Warehouse"],
    compliance: ["GST Registration", "PAN"],
  },
  "b-4": { // AgriExport India — Exporter, JNPT. Strict export-grade requirements.
    quantity: 1200, unit: "MT", moistureMax: 8, foreignMatterMax: 0.5,
    gradingStandard: "Export grade", packagingStandard: "Export cartons with phytosanitary labelling",
    traceabilityRequired: true, traceabilityNote: "Full export traceability, APEDA-registered lots",
    residueLimits: "MRL compliant with destination-market norms",
    storageCapacityRequiredMt: 300,
    states: ["Maharashtra"], seasons: ["Rabi"],
    certifications: ["APEDA", "Global GAP"],
    infrastructure: ["Cold Storage", "Testing Facility", "Grading Machine"],
    compliance: ["FSSAI License", "Insurance"],
  },
  "b-5": { // Patanjali Procurement — Development, Aurangabad. Contract farming.
    quantity: 2000, unit: "MT", moistureMax: null, foreignMatterMax: null,
    gradingStandard: "Sortex / Grade A", packagingStandard: "",
    traceabilityRequired: true, traceabilityNote: "Contract-farming compliance records per plot",
    residueLimits: "", storageCapacityRequiredMt: 250,
    states: ["Maharashtra"], seasons: ["Rabi"],
    certifications: ["Organic"],
    infrastructure: ["Warehouse", "Cleaning Unit", "Testing Facility"],
    compliance: ["Producer Company Registration", "Audited Financial Statements"],
  },
  "b-6": { // Local HORECA Supplies — Spot, Pune. Small, daily-fresh.
    quantity: 80, unit: "MT", moistureMax: null, foreignMatterMax: null,
    gradingStandard: "Grade A", packagingStandard: "Daily-fresh crates",
    traceabilityRequired: false, traceabilityNote: "",
    residueLimits: "", storageCapacityRequiredMt: 10,
    states: ["Maharashtra"], seasons: ["Year-round"],
    certifications: [],
    infrastructure: ["Cold Storage"],
    compliance: ["FSSAI License"],
  },
};

export async function backfillReadiness(db: DB): Promise<void> {
  /* ------------------------------------------------- buyers -> requirements */
  const buyers = (await db.execute(
    "SELECT id, quality_specs, typical_volume_mt, procurement_window FROM buyers;")).rows ?? [];

  for (const b of buyers) {
    const buyerId = str(b.id);
    const specs = str(b.quality_specs);
    const lower = specs.toLowerCase();
    const curated = CURATED_REQUIREMENTS[buyerId];

    const done = (await db.execute(
      "SELECT 1 AS ok FROM buyer_requirements WHERE buyer_id = ?;", [buyerId])).rows ?? [];
    if (done.length === 0) {
      if (curated != null) {
        await db.execute(
          `INSERT INTO buyer_requirements
             (buyer_id, quantity, unit, moisture_max, foreign_matter_max, grading_standard,
              packaging_standard, traceability_required, traceability_note, residue_limits,
              storage_capacity_required_mt)
           VALUES (?,?,?,?,?,?,?,?,?,?,?);`,
          [buyerId, curated.quantity, curated.unit, curated.moistureMax, curated.foreignMatterMax,
            curated.gradingStandard, curated.packagingStandard, curated.traceabilityRequired ? 1 : 0,
            curated.traceabilityNote, curated.residueLimits, curated.storageCapacityRequiredMt]);
      } else {
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
    }

    // What they buy is what they require.
    await db.execute(
      `INSERT OR IGNORE INTO buyer_requirement_commodities (buyer_id, commodity)
         SELECT buyer_id, commodity FROM buyer_commodities WHERE buyer_id = ?;`, [buyerId]);

    if (curated != null) {
      for (const state of curated.states) {
        await db.execute(
          "INSERT OR IGNORE INTO buyer_requirement_states (buyer_id, state) VALUES (?, ?);", [buyerId, state]);
      }
      for (const season of curated.seasons) {
        await db.execute(
          "INSERT OR IGNORE INTO buyer_requirement_seasons (buyer_id, season) VALUES (?, ?);", [buyerId, season]);
      }
      for (const cert of curated.certifications) {
        await db.execute(
          "INSERT OR IGNORE INTO buyer_required_certifications (buyer_id, certification) VALUES (?, ?);", [buyerId, cert]);
      }
      for (const item of curated.infrastructure) {
        await db.execute(
          "INSERT OR IGNORE INTO buyer_required_infrastructure (buyer_id, item) VALUES (?, ?);", [buyerId, item]);
      }
      for (const item of curated.compliance) {
        await db.execute(
          "INSERT OR IGNORE INTO buyer_required_compliance (buyer_id, item) VALUES (?, ?);", [buyerId, item]);
      }
    } else {
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
