import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Buyer demand / supplier supply postings — the ONLY real persistence in the
 * whole app (everything else is toast-only or component state).
 *
 * Ported from the web app's src/routes/buyer.index.tsx load/save helpers.
 * Storage keys are unchanged; localStorage -> AsyncStorage means these are now
 * async, so callers load them in an effect instead of inline during render.
 */

export interface Demand {
  id: string; commodity: string; qty_mt: number; delivery: string; grade: string; location: string;
}
export interface SupplyPost {
  id: string; item: string; category: string; qty: string; pricePerUnit: string; region: string; window: string;
}

const KEY = "setu.demands";
const SKEY = "setu.supplies";

export async function loadDemands(): Promise<Demand[]> {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || "[]"); } catch { return []; }
}
export async function saveDemands(d: Demand[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage unavailable */ }
}
export async function loadSupplies(): Promise<SupplyPost[]> {
  try { return JSON.parse((await AsyncStorage.getItem(SKEY)) || "[]"); } catch { return []; }
}
export async function saveSupplies(d: SupplyPost[]): Promise<void> {
  try { await AsyncStorage.setItem(SKEY, JSON.stringify(d)); } catch { /* storage unavailable */ }
}

/** Fallbacks used by the matching screen when nothing has been posted yet. */
export const DEFAULT_DEMAND: Demand = {
  id: "default", commodity: "Onion", qty_mt: 250, grade: "A", delivery: "2026-07-15", location: "Pune",
};
export const DEFAULT_SUPPLY: SupplyPost = {
  id: "default", item: "NPK 19:19:19", category: "Fertilizer", qty: "50 MT",
  pricePerUnit: "₹52/kg", region: "Western Maharashtra", window: "Aug – Sep",
};
