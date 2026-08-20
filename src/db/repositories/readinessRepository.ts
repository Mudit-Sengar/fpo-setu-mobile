import { withDb, withWrite } from "../connection";
import { requireProfile, type SessionContext } from "../authz";
import { COMPLIANCE_ITEMS, INFRASTRUCTURE_ITEMS } from "../readinessBackfill";

/**
 * What a buyer requires, what an FPO has, and the gap between them.
 *
 * The Market-Linked Growth Planning screen showed a readiness score of 62%, three
 * missing requirements and an investment figure of ₹2.25 Lakhs — all constants,
 * identical for every FPO and every buyer. This computes them: a score is the
 * share of the buyer's requirements the FPO meets, and the gaps are the ones it
 * does not.
 */

export interface BuyerRequirements {
  buyerId: string;
  quantity: number | null;
  unit: string;
  moistureMax: number | null;
  foreignMatterMax: number | null;
  gradingStandard: string;
  packagingStandard: string;
  traceabilityRequired: boolean;
  traceabilityNote: string;
  residueLimits: string;
  storageCapacityRequiredMt: number | null;
  commodities: string[];
  states: string[];
  seasons: string[];
  certifications: string[];
  infrastructure: string[];
  compliance: string[];
}

const EMPTY: Omit<BuyerRequirements, "buyerId"> = {
  quantity: null, unit: "MT", moistureMax: null, foreignMatterMax: null,
  gradingStandard: "", packagingStandard: "", traceabilityRequired: false,
  traceabilityNote: "", residueLimits: "", storageCapacityRequiredMt: null,
  commodities: [], states: [], seasons: [], certifications: [],
  infrastructure: [], compliance: [],
};

/** The list-valued fields, which live in their own tables. */
type ListKey = "commodities" | "states" | "seasons" | "certifications" | "infrastructure" | "compliance";

const CHILD_TABLES: { table: string; column: string; key: ListKey }[] = [
  { table: "buyer_requirement_commodities", column: "commodity", key: "commodities" },
  { table: "buyer_requirement_states", column: "state", key: "states" },
  { table: "buyer_requirement_seasons", column: "season", key: "seasons" },
  { table: "buyer_required_certifications", column: "certification", key: "certifications" },
  { table: "buyer_required_infrastructure", column: "item", key: "infrastructure" },
  { table: "buyer_required_compliance", column: "item", key: "compliance" },
];

export async function getBuyerRequirements(buyerId: string): Promise<BuyerRequirements> {
  return withDb("getBuyerRequirements", async (db) => {
    const rows = (await db.execute(
      "SELECT * FROM buyer_requirements WHERE buyer_id = ?;", [buyerId])).rows ?? [];
    const r = rows[0];

    const out: BuyerRequirements = { buyerId, ...EMPTY };
    if (r != null) {
      out.quantity = r.quantity == null ? null : Number(r.quantity);
      out.unit = String(r.unit ?? "MT");
      out.moistureMax = r.moisture_max == null ? null : Number(r.moisture_max);
      out.foreignMatterMax = r.foreign_matter_max == null ? null : Number(r.foreign_matter_max);
      out.gradingStandard = String(r.grading_standard ?? "");
      out.packagingStandard = String(r.packaging_standard ?? "");
      out.traceabilityRequired = Number(r.traceability_required ?? 0) === 1;
      out.traceabilityNote = String(r.traceability_note ?? "");
      out.residueLimits = String(r.residue_limits ?? "");
      out.storageCapacityRequiredMt = r.storage_capacity_required_mt == null
        ? null : Number(r.storage_capacity_required_mt);
    }

    for (const c of CHILD_TABLES) {
      const list = ((await db.execute(
        `SELECT ${c.column} AS v FROM ${c.table} WHERE buyer_id = ?;`, [buyerId])).rows ?? [])
        .map((x) => String(x.v));
      (out[c.key] as string[]) = list;
    }
    return out;
  });
}

export type RequirementsUpdate = Omit<BuyerRequirements, "buyerId">;

/**
 * Saves the Buyer Readiness form.
 *
 * Every one of these fields used to live in `useState` inside a throwaway
 * sub-component that the parent never read, so the form's only effect was to
 * navigate. The child sets are replaced wholesale inside one transaction —
 * a buyer left half-way through a requirement change would match on a mixture of
 * old and new criteria.
 */
export async function saveBuyerRequirements(
  ctx: SessionContext | null, input: RequirementsUpdate,
): Promise<void> {
  const buyerId = requireProfile(ctx, "buyer");

  await withWrite("saveBuyerRequirements", (db) => db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO buyer_requirements
         (buyer_id, quantity, unit, moisture_max, foreign_matter_max, grading_standard,
          packaging_standard, traceability_required, traceability_note, residue_limits,
          storage_capacity_required_mt, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
       ON CONFLICT (buyer_id) DO UPDATE SET
         quantity = excluded.quantity, unit = excluded.unit,
         moisture_max = excluded.moisture_max,
         foreign_matter_max = excluded.foreign_matter_max,
         grading_standard = excluded.grading_standard,
         packaging_standard = excluded.packaging_standard,
         traceability_required = excluded.traceability_required,
         traceability_note = excluded.traceability_note,
         residue_limits = excluded.residue_limits,
         storage_capacity_required_mt = excluded.storage_capacity_required_mt,
         updated_at = datetime('now');`,
      [buyerId, input.quantity, input.unit, input.moistureMax, input.foreignMatterMax,
        input.gradingStandard, input.packagingStandard, input.traceabilityRequired ? 1 : 0,
        input.traceabilityNote, input.residueLimits, input.storageCapacityRequiredMt]);

    for (const c of CHILD_TABLES) {
      await tx.execute(`DELETE FROM ${c.table} WHERE buyer_id = ?;`, [buyerId]);
      for (const value of input[c.key] as string[]) {
        if (value === "") continue;
        await tx.execute(
          `INSERT OR IGNORE INTO ${c.table} (buyer_id, ${c.column}) VALUES (?, ?);`,
          [buyerId, value]);
      }
    }
  }));
}

/** Kilometres between every pair of districts, for the matching screens. */
export async function distanceMatrix(): Promise<Map<string, number>> {
  return withDb("distanceMatrix", async (db) => {
    const rows = (await db.execute("SELECT from_district, to_district, km FROM district_distances;")).rows ?? [];
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(`${String(r.from_district)}|${String(r.to_district)}`, Number(r.km ?? 0));
    }
    return map;
  });
}

/** Reads a distance out of the matrix. Null when either district is unknown. */
export function kmBetween(
  matrix: Map<string, number>, from: string | null | undefined, to: string | null | undefined,
): number | null {
  if (from == null || to == null || from === "" || to === "") return null;
  return matrix.get(`${from}|${to}`) ?? null;
}

/* ------------------------------------------------------------- readiness -- */

export interface Gap {
  requirement: string;
  category: "infrastructure" | "certification" | "compliance" | "quality" | "capacity";
  status: "met" | "partial" | "missing";
  estCost: number;
}

export interface Assessment {
  score: number;
  estInvestment: number;
  gaps: Gap[];
  buyerName: string;
  crop: string;
  /** Requirements the buyer stated at all. Zero means nothing to assess against. */
  requirementCount: number;
}

/**
 * Indicative cost of closing a gap, in rupees.
 *
 * These are order-of-magnitude figures for planning, not quotes — the screen used
 * to show a single ₹2.25 Lakh total for every FPO and every buyer, which was one
 * number pretending to be an estimate. Naming a cost per item at least makes the
 * total change with what is actually missing.
 */
const GAP_COST: Record<string, number> = {
  "Warehouse": 150000,
  "Cleaning Unit": 60000,
  "Sorting Line": 90000,
  "Grading Machine": 75000,
  "Digital Record Keeping": 15000,
  "Cold Storage": 250000,
  "Testing Facility": 45000,
  "Organic": 40000,
  "Global GAP": 60000,
  "FSSAI": 12000,
  "ISO": 55000,
  "APEDA": 15000,
};

const COMPLIANCE_COST = 10000;
const QUALITY_EQUIPMENT_COST = 25000;

/**
 * Compares one FPO against one buyer's stated requirements.
 *
 * Returns a score out of 100 — the share of requirements met, with partials
 * counting half — plus the specific gaps behind it.
 */
export async function assess(
  fpoId: string, buyerId: string, crop: string,
): Promise<Assessment> {
  const requirements = await getBuyerRequirements(buyerId);

  return withDb("assessReadiness", async (db) => {
    const buyerRow = (await db.execute("SELECT name FROM buyers WHERE id = ?;", [buyerId])).rows ?? [];
    const buyerName = String(buyerRow[0]?.name ?? "");

    const infra = new Map(((await db.execute(
      "SELECT item, present FROM fpo_infrastructure WHERE fpo_id = ?;", [fpoId])).rows ?? [])
      .map((r) => [String(r.item), Number(r.present ?? 0) === 1]));
    const certs = new Set(((await db.execute(
      "SELECT certification FROM fpo_certifications WHERE fpo_id = ?;", [fpoId])).rows ?? [])
      .map((r) => String(r.certification)));
    const compliance = new Map(((await db.execute(
      "SELECT item, held FROM fpo_compliance WHERE fpo_id = ?;", [fpoId])).rows ?? [])
      .map((r) => [String(r.item), Number(r.held ?? 0) === 1]));
    const fpoRow = (await db.execute(
      "SELECT warehouse_mt FROM fpos WHERE id = ?;", [fpoId])).rows ?? [];
    const warehouseMt = Number(fpoRow[0]?.warehouse_mt ?? 0);

    const gaps: Gap[] = [];
    const add = (requirement: string, category: Gap["category"], met: boolean, cost: number) => {
      gaps.push({ requirement, category, status: met ? "met" : "missing", estCost: met ? 0 : cost });
    };

    // Infrastructure the buyer asked for. When they have not filled the form,
    // fall back to nothing rather than assuming a standard list — an empty
    // requirement set produces a zero-requirement assessment, which the caller
    // renders as "this buyer has not published requirements".
    for (const item of requirements.infrastructure) {
      if (!(INFRASTRUCTURE_ITEMS as readonly string[]).includes(item)) continue;
      add(item, "infrastructure", infra.get(item) === true, GAP_COST[item] ?? 50000);
    }

    for (const cert of requirements.certifications) {
      add(cert, "certification", certs.has(cert), GAP_COST[cert] ?? 30000);
    }

    for (const item of requirements.compliance) {
      if (!(COMPLIANCE_ITEMS as readonly string[]).includes(item)) continue;
      add(item, "compliance", compliance.get(item) === true, COMPLIANCE_COST);
    }

    // Quality limits imply testing equipment: an FPO cannot certify moisture it
    // cannot measure.
    if (requirements.moistureMax != null || requirements.foreignMatterMax != null) {
      add("Moisture / foreign matter testing", "quality",
        infra.get("Testing Facility") === true, QUALITY_EQUIPMENT_COST);
    }

    if (requirements.storageCapacityRequiredMt != null && requirements.storageCapacityRequiredMt > 0) {
      const met = warehouseMt >= requirements.storageCapacityRequiredMt;
      const shortfall = Math.max(0, requirements.storageCapacityRequiredMt - warehouseMt);
      gaps.push({
        requirement: `Storage for ${requirements.storageCapacityRequiredMt} MT`,
        category: "capacity",
        status: met ? "met" : warehouseMt > 0 ? "partial" : "missing",
        // Partial credit costs proportionally less than starting from nothing.
        estCost: met ? 0 : Math.round(shortfall * 1200),
      });
    }

    const requirementCount = gaps.length;
    if (requirementCount === 0) {
      return { score: 0, estInvestment: 0, gaps: [], buyerName, crop, requirementCount: 0 };
    }

    const earned = gaps.reduce(
      (sum, g) => sum + (g.status === "met" ? 1 : g.status === "partial" ? 0.5 : 0), 0);
    const score = Math.round((earned / requirementCount) * 100);
    const estInvestment = gaps.reduce((sum, g) => sum + g.estCost, 0);

    return { score, estInvestment, gaps, buyerName, crop, requirementCount };
  });
}

/** Records an assessment so improvement over time is visible. */
export async function saveAssessment(
  ctx: SessionContext | null, buyerId: string, crop: string, a: Assessment,
): Promise<void> {
  const fpoId = requireProfile(ctx, "fpo");

  await withWrite("saveAssessment", (db) => db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO fpo_readiness_assessments (fpo_id, buyer_id, crop, score, est_investment)
       VALUES (?,?,?,?,?);`,
      [fpoId, buyerId, crop, a.score, a.estInvestment]);
    const created = (await tx.execute(
      "SELECT id FROM fpo_readiness_assessments WHERE fpo_id = ? ORDER BY id DESC LIMIT 1;",
      [fpoId])).rows ?? [];
    const assessmentId = Number(created[0].id);

    for (const g of a.gaps) {
      await tx.execute(
        `INSERT OR IGNORE INTO fpo_readiness_gaps (assessment_id, requirement, category, status, est_cost)
         VALUES (?,?,?,?,?);`,
        [assessmentId, g.requirement, g.category, g.status, g.estCost]);
    }
  }));
}

/** Past assessments for one FPO, newest first — the improvement trail. */
export async function listAssessments(
  fpoId: string,
): Promise<{ id: number; buyerId: string; crop: string; score: number; assessedAt: string }[]> {
  return withDb("listAssessments", async (db) => {
    const rows = (await db.execute(
      `SELECT id, buyer_id, crop, score, assessed_at FROM fpo_readiness_assessments
        WHERE fpo_id = ? ORDER BY assessed_at DESC, id DESC LIMIT 20;`, [fpoId])).rows ?? [];
    return rows.map((r) => ({
      id: Number(r.id),
      buyerId: String(r.buyer_id),
      crop: String(r.crop),
      score: Number(r.score ?? 0),
      assessedAt: String(r.assessed_at ?? ""),
    }));
  });
}

/** Marks one infrastructure item present or absent for the signed-in FPO. */
export async function setInfrastructure(
  ctx: SessionContext | null, item: string, present: boolean,
): Promise<void> {
  const fpoId = requireProfile(ctx, "fpo");
  await withWrite("setInfrastructure", (db) => db.execute(
    `INSERT INTO fpo_infrastructure (fpo_id, item, present) VALUES (?,?,?)
     ON CONFLICT (fpo_id, item) DO UPDATE SET present = excluded.present;`,
    [fpoId, item, present ? 1 : 0]));
}

/** Records or removes a certification for the signed-in FPO. */
export async function setCertification(
  ctx: SessionContext | null, certification: string, held: boolean,
): Promise<void> {
  const fpoId = requireProfile(ctx, "fpo");
  await withWrite("setCertification", (db) => (held
    ? db.execute(
      "INSERT OR IGNORE INTO fpo_certifications (fpo_id, certification) VALUES (?, ?);",
      [fpoId, certification])
    : db.execute(
      "DELETE FROM fpo_certifications WHERE fpo_id = ? AND certification = ?;",
      [fpoId, certification])));
}
