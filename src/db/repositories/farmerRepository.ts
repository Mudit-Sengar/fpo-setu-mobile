import { withDb } from "../connection";
import type { Farmer, FarmerBuyerMatch, FarmerTxn, SimilarFarmer } from "../types";

/** Farmers, their transactions, and the farmer-side match/discovery lists. */

export async function listFarmers(): Promise<Farmer[]> {
  return withDb("listFarmers", async (db) => {
    const rows = (await db.execute("SELECT * FROM farmers ORDER BY name;")).rows ?? [];
    return Promise.all(rows.map(hydrateFarmer));
  });
}

export async function getFarmerById(id: string): Promise<Farmer | null> {
  return withDb("getFarmerById", async (db) => {
    const rows = (await db.execute("SELECT * FROM farmers WHERE id = ?;", [id])).rows ?? [];
    if (rows.length === 0) return null;
    return hydrateFarmer(rows[0]);
  });
}

async function hydrateFarmer(r: Record<string, unknown>): Promise<Farmer> {
  return withDb("hydrateFarmer", async (db) => {
    const id = String(r.id);
    const crops = ((await db.execute("SELECT crop FROM farmer_crops WHERE farmer_id = ?;", [id])).rows ?? [])
      .map((x) => String(x.crop));
    const txns = ((await db.execute("SELECT * FROM farmer_txns WHERE farmer_id = ? ORDER BY id;", [id])).rows ?? [])
      .map(toTxn);

    return {
      id,
      name: String(r.name),
      village: String(r.village ?? ""),
      district: String(r.district ?? ""),
      landAcres: Number(r.land_acres ?? 0),
      crops,
      fpoId: r.fpo_id == null ? null : String(r.fpo_id),
      sharePct: Number(r.share_pct ?? 0),
      memberSince: r.member_since == null ? undefined : String(r.member_since),
      txns,
    };
  });
}

const toTxn = (r: Record<string, unknown>): FarmerTxn => ({
  date: String(r.date),
  crop: String(r.crop ?? ""),
  qty_q: Number(r.qty_q ?? 0),
  price: Number(r.price ?? 0),
  amount: Number(r.amount ?? 0),
  refId: r.ref_id == null ? undefined : String(r.ref_id),
});

/**
 * The AgriStack-derived profile fields (taluka/state/survey/khasra) that used to be
 * hardcoded locals in FarmerProfileScreen.tsx. Kept separate from `Farmer` so that
 * type stays identical to what every other screen already expects.
 */
export interface FarmerProfileExtras {
  taluka: string;
  state: string;
  surveyNo: string;
  khasraNo: string;
}

export async function getFarmerProfileExtras(id: string): Promise<FarmerProfileExtras | null> {
  return withDb("getFarmerProfileExtras", async (db) => {
    const rows = (await db.execute(
      "SELECT taluka, state, survey_no, khasra_no FROM farmers WHERE id = ?;", [id])).rows ?? [];
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      taluka: String(r.taluka ?? ""),
      state: String(r.state ?? ""),
      surveyNo: String(r.survey_no ?? ""),
      khasraNo: String(r.khasra_no ?? ""),
    };
  });
}

export async function listFarmerBuyerMatches(): Promise<FarmerBuyerMatch[]> {
  return withDb("listFarmerBuyerMatches", async (db) => {
    const rows = (await db.execute("SELECT * FROM farmer_buyer_matches;")).rows ?? [];
    return rows.map((r) => ({
      id: String(r.id),
      buyer: String(r.buyer),
      crop: String(r.crop ?? ""),
      grade: String(r.grade ?? ""),
      qty: String(r.qty ?? ""),
      window: String(r.window ?? ""),
      location: String(r.location ?? ""),
      distanceKm: Number(r.distance_km ?? 0),
    }));
  });
}

export async function listSimilarFarmers(): Promise<SimilarFarmer[]> {
  return withDb("listSimilarFarmers", async (db) => {
    const rows = (await db.execute("SELECT * FROM similar_farmers;")).rows ?? [];
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      village: String(r.village ?? ""),
      district: String(r.district ?? ""),
      crop: String(r.crop ?? ""),
      grade: String(r.grade ?? ""),
      quality: String(r.quality ?? ""),
      landAcres: Number(r.land_acres ?? 0),
      distanceKm: Number(r.distance_km ?? 0),
    }));
  });
}
