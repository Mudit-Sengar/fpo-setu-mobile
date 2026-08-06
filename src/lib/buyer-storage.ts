import { marketRepo } from "../db";
import type { Demand, SupplyPost } from "../db/types";

/**
 * Buyer demand / supplier supply postings.
 *
 * These used to be JSON blobs in AsyncStorage (keys "setu.demands"/"setu.supplies").
 * They now live in the `demands` / `supplies` SQLite tables — this module stays as a
 * thin façade so the buyer screens keep their existing call sites, and so the
 * save-whole-array semantics they were written against still work.
 *
 * NOTE: pre-existing AsyncStorage postings are NOT migrated. They were demo data
 * created during testing, and the tables seed empty by design.
 */

export type { Demand, SupplyPost };

export async function loadDemands(): Promise<Demand[]> {
  try { return await marketRepo.listDemands(); } catch { return []; }
}

/**
 * Persists any demand in `list` that isn't stored yet. Callers pass the full
 * array (the old AsyncStorage contract); inserts are keyed on id, so re-saving an
 * unchanged list is a no-op rather than a duplicate.
 */
export async function saveDemands(list: Demand[]): Promise<void> {
  try {
    const existing = new Set((await marketRepo.listDemands()).map((d) => d.id));
    for (const d of list) {
      if (!existing.has(d.id)) await marketRepo.insertDemand(d);
    }
  } catch { /* database unavailable — the UI keeps its optimistic local copy */ }
}

export async function loadSupplies(): Promise<SupplyPost[]> {
  try { return await marketRepo.listSupplies(); } catch { return []; }
}

export async function saveSupplies(list: SupplyPost[]): Promise<void> {
  try {
    const existing = new Set((await marketRepo.listSupplies()).map((s) => s.id));
    for (const s of list) {
      if (!existing.has(s.id)) await marketRepo.insertSupply(s);
    }
  } catch { /* database unavailable — the UI keeps its optimistic local copy */ }
}

/** Fallbacks used by the matching screen when nothing has been posted yet. */
export const DEFAULT_DEMAND: Demand = {
  id: "default", commodity: "Onion", qty_mt: 250, grade: "A", delivery: "2026-07-15", location: "Pune",
};
export const DEFAULT_SUPPLY: SupplyPost = {
  id: "default", item: "NPK 19:19:19", category: "Fertilizer", qty: "50 MT",
  pricePerUnit: "₹52/kg", region: "Western Maharashtra", window: "Aug – Sep",
};
