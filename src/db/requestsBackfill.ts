import type { DB } from "@op-engineering/op-sqlite";
import { parseQuantity } from "../lib/quantity";

/**
 * Carries the pre-004 posting tables into `requests`.
 *
 * Runs on every launch rather than inside migration 004, for two reasons:
 *
 *  1. Free-text quantities. `input_needs.qty` holds strings like "12 units x 4
 *     days" and `supplier_postings.qty` holds "2,000 kg". SQL cannot parse those;
 *     TypeScript can.
 *  2. Ordering. Migrations run BEFORE seeding, so on a first install a backfill
 *     written into 004 would execute against empty tables and silently do
 *     nothing, leaving a fresh install with no requests at all.
 *
 * Idempotency comes from `requests.source_ref`, which records where each row came
 * from ('fpo_supply:12'). Re-running inserts nothing new.
 */

interface Row { [k: string]: unknown }

const str = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));
const num = (v: unknown): number => Number(v ?? 0);

/** Party id for an entity, or null when the entity has no party row. */
async function partyOf(db: DB, kind: string, entityId: string): Promise<number | null> {
  const rows = (await db.execute(
    "SELECT id FROM parties WHERE kind = ? AND entity_id = ? LIMIT 1;", [kind, entityId])).rows ?? [];
  return rows.length === 0 ? null : Number(rows[0].id);
}

/** The first party of a kind, used only where the legacy row has no author at all. */
async function firstPartyOf(db: DB, kind: string): Promise<number | null> {
  const rows = (await db.execute(
    "SELECT id FROM parties WHERE kind = ? ORDER BY id LIMIT 1;", [kind])).rows ?? [];
  return rows.length === 0 ? null : Number(rows[0].id);
}

interface NewRequest {
  authorPartyId: number;
  kind: string;
  item: string;
  category: string | null;
  grade: string | null;
  qty: number;
  qtyLabel: string | null;
  unit: string;
  windowLabel: string | null;
  district: string | null;
  sourceRef: string;
}

async function insert(db: DB, r: NewRequest): Promise<void> {
  await db.execute(
    `INSERT OR IGNORE INTO requests
       (author_party_id, kind, item, category, grade, qty, qty_label, unit,
        window_label, district, status, source_ref)
     VALUES (?,?,?,?,?,?,?,?,?,?,'open',?);`,
    [r.authorPartyId, r.kind, r.item, r.category, r.grade, r.qty, r.qtyLabel,
      r.unit, r.windowLabel, r.district, r.sourceRef],
  );
}

export async function backfillRequests(db: DB): Promise<void> {
  /* ------------------------------- FPO commodity supply (fpo_supply) ------ */
  const supply = (await db.execute(
    `SELECT s.id, s.fpo_id, s.commodity, s.qty_mt, s.grade, s.harvest_window, f.district
       FROM fpo_supply s JOIN fpos f ON f.id = s.fpo_id;`)).rows ?? [];
  for (const r of supply as Row[]) {
    const author = await partyOf(db, "fpo", str(r.fpo_id));
    if (author == null) continue;
    await insert(db, {
      authorPartyId: author,
      kind: "commodity_supply",
      item: str(r.commodity),
      category: null,
      grade: str(r.grade) || null,
      qty: num(r.qty_mt),
      qtyLabel: null,
      unit: "MT",
      windowLabel: str(r.harvest_window) || null,
      district: str(r.district) || null,
      sourceRef: `fpo_supply:${str(r.id)}`,
    });
  }

  /* ---------------------------------- FPO input demand (input_needs) ------ */
  const needs = (await db.execute(
    `SELECT n.id, n.fpo_id, n.item, n.category, n.qty, n.window, f.district
       FROM input_needs n JOIN fpos f ON f.id = n.fpo_id;`)).rows ?? [];
  for (const r of needs as Row[]) {
    const author = await partyOf(db, "fpo", str(r.fpo_id));
    if (author == null) continue;
    const q = parseQuantity(str(r.qty));
    await insert(db, {
      authorPartyId: author,
      kind: "input_demand",
      item: str(r.item),
      category: str(r.category) || null,
      grade: null,
      qty: q.qty,
      qtyLabel: q.label || null,
      unit: q.unit,
      windowLabel: str(r.window) || null,
      district: str(r.district) || null,
      sourceRef: `input_needs:${str(r.id)}`,
    });
  }

  /* ----------------------------- supplier input supply (supplier_postings) - */
  const postings = (await db.execute(
    "SELECT id, supplier_id, item, category, qty, price_per_unit, region, window FROM supplier_postings;")).rows ?? [];
  for (const r of postings as Row[]) {
    const supplierId = str(r.supplier_id);
    const author = supplierId === ""
      ? await firstPartyOf(db, "supplier")
      : await partyOf(db, "supplier", supplierId);
    if (author == null) continue;
    const q = parseQuantity(str(r.qty));
    await insert(db, {
      authorPartyId: author,
      kind: "input_supply",
      item: str(r.item),
      category: str(r.category) || null,
      grade: null,
      qty: q.qty,
      qtyLabel: q.label || null,
      unit: q.unit,
      windowLabel: str(r.window) || null,
      district: str(r.region) || null,
      sourceRef: `supplier_postings:${str(r.id)}`,
    });
  }

  /* --------------------------------------- buyer demands (demands) -------- */
  // `demands` has no buyer column — that missing author is one of the reasons
  // this phase exists. Rows here were created on this device by whoever was
  // signed in as a buyer, so they are attributed to the first buyer party. On a
  // fresh install the table is empty and this attributes nothing.
  const demands = (await db.execute(
    "SELECT id, commodity, qty_mt, grade, delivery, location FROM demands;")).rows ?? [];
  if (demands.length > 0) {
    const author = await firstPartyOf(db, "buyer");
    if (author != null) {
      for (const r of demands as Row[]) {
        await insert(db, {
          authorPartyId: author,
          kind: "commodity_demand",
          item: str(r.commodity),
          category: null,
          grade: str(r.grade) || null,
          qty: num(r.qty_mt),
          qtyLabel: null,
          unit: "MT",
          windowLabel: str(r.delivery) || null,
          district: str(r.location) || null,
          sourceRef: `demands:${str(r.id)}`,
        });
      }
    }
  }

  /* ------------------------------------- supplier supplies (supplies) ----- */
  // Same missing-author problem as `demands`.
  const supplies = (await db.execute(
    "SELECT id, item, category, qty, price_per_unit, region, window FROM supplies;")).rows ?? [];
  if (supplies.length > 0) {
    const author = await firstPartyOf(db, "supplier");
    if (author != null) {
      for (const r of supplies as Row[]) {
        const q = parseQuantity(str(r.qty));
        await insert(db, {
          authorPartyId: author,
          kind: "input_supply",
          item: str(r.item),
          category: str(r.category) || null,
          grade: null,
          qty: q.qty,
          qtyLabel: q.label || null,
          unit: q.unit,
          windowLabel: str(r.window) || null,
          district: str(r.region) || null,
          sourceRef: `supplies:${str(r.id)}`,
        });
      }
    }
  }
}
