import { withDb } from "../connection";
import type { Buyer, BuyerType, Demand, LookupKind, Review, Supplier, SupplyPost, SupplyPosting } from "../types";

/** Buyers, suppliers, their postings, plus demand/supply/review writes and lookups. */

/* ------------------------------------------------------------- buyers ---- */

export async function listBuyers(): Promise<Buyer[]> {
  return withDb("listBuyers", async (db) => {
    const rows = (await db.execute("SELECT * FROM buyers ORDER BY name;")).rows ?? [];
    return Promise.all(rows.map(async (r) => {
      const id = String(r.id);
      const commodities = ((await db.execute(
        "SELECT commodity FROM buyer_commodities WHERE buyer_id = ?;", [id])).rows ?? [])
        .map((x) => String(x.commodity));
      return {
        id,
        name: String(r.name),
        type: String(r.type ?? "") as BuyerType,
        category: String(r.category ?? "") as Buyer["category"],
        commodities,
        typicalVolumeMT: Number(r.typical_volume_mt ?? 0),
        location: String(r.location ?? ""),
        qualitySpecs: String(r.quality_specs ?? ""),
        procurementWindow: String(r.procurement_window ?? ""),
      };
    }));
  });
}

/** A single buyer by id — used to load the signed-in buyer's own profile. */
export async function getBuyerById(id: string): Promise<Buyer | null> {
  const buyers = await listBuyers();
  return buyers.find((b) => b.id === id) ?? null;
}

/** Grouped by category — replaces mockData's buyersByCategory() helper. */
export async function buyersByCategory(): Promise<Record<string, Buyer[]>> {
  const buyers = await listBuyers();
  return buyers.reduce<Record<string, Buyer[]>>((acc, b) => {
    (acc[b.category] ??= []).push(b);
    return acc;
  }, {});
}

/* ---------------------------------------------------------- suppliers ---- */

export async function listSuppliers(): Promise<Supplier[]> {
  return withDb("listSuppliers", async (db) => {
    const rows = (await db.execute("SELECT * FROM suppliers ORDER BY name;")).rows ?? [];
    return Promise.all(rows.map(async (r) => {
      const id = String(r.id);
      const categories = ((await db.execute(
        "SELECT category FROM supplier_categories WHERE supplier_id = ?;", [id])).rows ?? [])
        .map((x) => String(x.category));
      return {
        id,
        name: String(r.name),
        brand: String(r.brand ?? ""),
        categories,
        products: String(r.products ?? ""),
        priceRange: String(r.price_range ?? ""),
        certifications: String(r.certifications ?? ""),
        regions: String(r.regions ?? ""),
        minOrder: String(r.min_order ?? ""),
        leadTimeDays: Number(r.lead_time_days ?? 0),
        seasons: String(r.seasons ?? ""),
        location: String(r.location ?? ""),
      };
    }));
  });
}

export async function listSupplierPostings(): Promise<SupplyPosting[]> {
  return withDb("listSupplierPostings", async (db) => {
    const rows = (await db.execute("SELECT * FROM supplier_postings;")).rows ?? [];
    return rows.map((r) => ({
      id: String(r.id),
      item: String(r.item),
      category: String(r.category ?? ""),
      qty: String(r.qty ?? ""),
      pricePerUnit: String(r.price_per_unit ?? ""),
      region: String(r.region ?? ""),
      window: String(r.window ?? ""),
    }));
  });
}

/* ------------------------------------------- demands (buyer postings) ---- */

export async function listDemands(): Promise<Demand[]> {
  return withDb("listDemands", async (db) => {
    const rows = (await db.execute("SELECT * FROM demands ORDER BY created_at DESC, rowid DESC;")).rows ?? [];
    return rows.map((r) => ({
      id: String(r.id),
      commodity: String(r.commodity),
      qty_mt: Number(r.qty_mt ?? 0),
      grade: String(r.grade ?? ""),
      delivery: String(r.delivery ?? ""),
      location: String(r.location ?? ""),
    }));
  });
}

export async function insertDemand(d: Demand): Promise<void> {
  await withDb("insertDemand", (db) =>
    db.execute(
      "INSERT INTO demands (id, commodity, qty_mt, grade, delivery, location) VALUES (?,?,?,?,?,?);",
      [d.id, d.commodity, d.qty_mt, d.grade, d.delivery, d.location],
    ));
}

/* --------------------------------------- supplies (supplier postings) ---- */

export async function listSupplies(): Promise<SupplyPost[]> {
  return withDb("listSupplies", async (db) => {
    const rows = (await db.execute("SELECT * FROM supplies ORDER BY created_at DESC, rowid DESC;")).rows ?? [];
    return rows.map((r) => ({
      id: String(r.id),
      item: String(r.item),
      category: String(r.category ?? ""),
      qty: String(r.qty ?? ""),
      pricePerUnit: String(r.price_per_unit ?? ""),
      region: String(r.region ?? ""),
      window: String(r.window ?? ""),
    }));
  });
}

export async function insertSupply(s: SupplyPost): Promise<void> {
  await withDb("insertSupply", (db) =>
    db.execute(
      "INSERT INTO supplies (id, item, category, qty, price_per_unit, region, window) VALUES (?,?,?,?,?,?,?);",
      [s.id, s.item, s.category, s.qty, s.pricePerUnit, s.region, s.window],
    ));
}

/* ------------------------------------------------------------ reviews ---- */

export async function insertReview(r: Review): Promise<void> {
  await withDb("insertReview", (db) =>
    db.execute(
      `INSERT INTO reviews (target_id, target_type, quality, delivery, communication, note)
       VALUES (?,?,?,?,?,?);`,
      [r.targetId, r.targetType, r.quality, r.delivery, r.communication, r.note],
    ));
}

export async function listReviews(targetType: Review["targetType"], targetId: string): Promise<Review[]> {
  return withDb("listReviews", async (db) => {
    const rows = (await db.execute(
      "SELECT * FROM reviews WHERE target_type = ? AND target_id = ? ORDER BY id DESC;",
      [targetType, targetId])).rows ?? [];
    return rows.map((r) => ({
      id: Number(r.id),
      targetId: String(r.target_id),
      targetType: String(r.target_type) as Review["targetType"],
      quality: Number(r.quality ?? 0),
      delivery: Number(r.delivery ?? 0),
      communication: Number(r.communication ?? 0),
      note: String(r.note ?? ""),
      createdAt: String(r.created_at ?? ""),
    }));
  });
}

/* ------------------------------------------------------------ lookups ---- */

export async function listLookup(kind: LookupKind): Promise<string[]> {
  return withDb("listLookup", async (db) => {
    const rows = (await db.execute(
      "SELECT value FROM lookup_values WHERE kind = ? ORDER BY sort_order;", [kind])).rows ?? [];
    return rows.map((r) => String(r.value));
  });
}

/* ------------------------------------------------------- market data ---- */

export async function getDailyPrices(crop: string): Promise<{ date: string; price: number }[]> {
  return withDb("getDailyPrices", async (db) => {
    const rows = (await db.execute(
      "SELECT date, price FROM daily_apmc_prices WHERE crop = ? ORDER BY date;", [crop])).rows ?? [];
    return rows.map((r) => ({ date: String(r.date), price: Number(r.price ?? 0) }));
  });
}

export async function listPricedCrops(): Promise<string[]> {
  return withDb("listPricedCrops", async (db) => {
    const rows = (await db.execute("SELECT DISTINCT crop FROM daily_apmc_prices ORDER BY crop;")).rows ?? [];
    return rows.map((r) => String(r.crop));
  });
}
