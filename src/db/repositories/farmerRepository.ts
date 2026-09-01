import { withDb, withWrite } from "../connection";
import { AuthzError, requireProfile, type SessionContext } from "../authz";
import type { Farmer, FarmerTxn } from "../types";

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
    // FPO membership comes from `memberships`, not the retired `farmers.fpo_id`
    // column: belonging is now a row with a status and a history, and reading it
    // from one place is what keeps an approval visible everywhere at once.
    const membership = ((await db.execute(
      `SELECT fpo_id, share_pct, joined_at FROM memberships
        WHERE farmer_id = ? AND status = 'active' LIMIT 1;`, [id])).rows ?? [])[0];

    return {
      id,
      name: String(r.name),
      village: String(r.village ?? ""),
      district: String(r.district ?? ""),
      landAcres: Number(r.land_acres ?? 0),
      crops,
      fpoId: membership == null ? null : String(membership.fpo_id),
      sharePct: membership == null ? 0 : Number(membership.share_pct ?? 0),
      memberSince: membership?.joined_at == null
        ? (r.member_since == null ? undefined : String(r.member_since))
        : String(membership.joined_at),
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


/** The farmer id (farmers.id) behind a party row, or null if it isn't a farmer. */
export async function getFarmerIdForParty(partyId: number): Promise<string | null> {
  return withDb("getFarmerIdForParty", async (db) => {
    const rows = (await db.execute(
      "SELECT entity_id FROM parties WHERE id = ? AND kind = 'farmer';", [partyId])).rows ?? [];
    return rows.length === 0 ? null : String(rows[0].entity_id);
  });
}

export interface NewFarmerTxn {
  date: string;
  crop: string;
  qtyQ: number;
  price: number;
  amount: number;
  /** The `ledger_entries` row this transaction was posted alongside, if any — see migration 014. */
  ledgerEntryId?: number | null;
}

/**
 * Records a produce transaction directly against a farmer.
 *
 * Order-settled transactions already reach `farmer_txns` via
 * `orderRepository.postAccounting`; this is the same insert for the FPO's
 * manual bookkeeping path (`AddEntry`), so a ledger entry against a member
 * shows up on that farmer's own "My FPO" transaction history too. Linking it to
 * the ledger entry that caused it (rather than leaving two independent inserts
 * that merely agree) is what lets deleting that ledger entry take this row with
 * it — see `fpoRepository.deleteLedgerEntry`.
 */
export async function recordFarmerTransaction(
  farmerId: string, fpoId: string, t: NewFarmerTxn,
): Promise<void> {
  await withWrite("recordFarmerTransaction", async (db) => {
    const membership = (await db.execute(
      "SELECT id FROM memberships WHERE farmer_id = ? AND fpo_id = ? AND status = 'active' LIMIT 1;",
      [farmerId, fpoId])).rows ?? [];

    await db.execute(
      `INSERT INTO farmer_txns (farmer_id, date, crop, qty_q, price, amount, membership_id, ledger_entry_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [farmerId, t.date, t.crop, t.qtyQ, t.price, t.amount,
        membership.length > 0 ? Number(membership[0].id) : null, t.ledgerEntryId ?? null]);
  });
}

export interface MemberProfileEdit {
  village?: string | null;
  landAcres?: number | null;
  crops?: string[] | null;
}

/**
 * FPO-side edit of a member's profile fields (village, landholding, crops).
 *
 * Same fields and replace-semantics `membershipRepository.apply()` already
 * updates when a farmer corrects their own details on the application form —
 * only the authorization direction is reversed: the FPO may edit any farmer
 * who is currently an active member of it.
 */
export async function updateMemberProfile(
  ctx: SessionContext | null, farmerId: string, edit: MemberProfileEdit,
): Promise<void> {
  const fpoId = requireProfile(ctx, "fpo");

  await withWrite("updateMemberProfile", async (db) => {
    const owns = (await db.execute(
      "SELECT 1 AS ok FROM memberships WHERE farmer_id = ? AND fpo_id = ? AND status = 'active';",
      [farmerId, fpoId])).rows ?? [];
    if (owns.length === 0) throw new AuthzError("That farmer is not an active member of your FPO.");

    if (edit.village != null && edit.village !== "") {
      await db.execute("UPDATE farmers SET village = ? WHERE id = ?;", [edit.village, farmerId]);
    }
    if (edit.landAcres != null && edit.landAcres > 0) {
      await db.execute("UPDATE farmers SET land_acres = ? WHERE id = ?;", [edit.landAcres, farmerId]);
    }
    if (edit.crops != null && edit.crops.length > 0) {
      await db.execute("DELETE FROM farmer_crops WHERE farmer_id = ?;", [farmerId]);
      for (const crop of edit.crops) {
        await db.execute(
          "INSERT OR IGNORE INTO farmer_crops (farmer_id, crop) VALUES (?, ?);", [farmerId, crop]);
      }
    }
  });
}

/** A farmer growing the same crop, with the party id needed to connect to them. */
export interface PeerFarmer {
  id: string;
  partyId: number;
  name: string;
  village: string;
  district: string;
  landAcres: number;
  crops: string[];
}

/**
 * Other farmers growing a given crop.
 *
 * Replaces `listSimilarFarmers`, which returned six invented people with no party
 * and therefore nobody to send a connection request to. These are real rows: the
 * seeded peers were promoted into `farmers` (see src/db/parties.ts), so every one
 * of them has a party and can receive a request and a message.
 *
 * The old `grade` and `quality` filters are gone with that table. They described
 * produce rather than a person, and belong on a supply posting.
 */
export async function listPeerFarmers(
  crop: string, excludeFarmerId: string | null, district: string | null,
): Promise<PeerFarmer[]> {
  return withDb("listPeerFarmers", async (db) => {
    const rows = (await db.execute(
      `SELECT f.id, f.name, f.village, f.district, f.land_acres, p.id AS party_id
         FROM farmers f
         JOIN farmer_crops fc ON fc.farmer_id = f.id
         JOIN parties p ON p.kind = 'farmer' AND p.entity_id = f.id AND p.is_active = 1
        WHERE LOWER(fc.crop) = LOWER(?) AND f.id <> ?
        ORDER BY CASE WHEN f.district = ? THEN 0 ELSE 1 END, f.name;`,
      [crop, excludeFarmerId ?? "", district ?? ""])).rows ?? [];

    return Promise.all(rows.map(async (r) => {
      const id = String(r.id);
      const crops = ((await db.execute(
        "SELECT crop FROM farmer_crops WHERE farmer_id = ?;", [id])).rows ?? [])
        .map((x) => String(x.crop));
      return {
        id,
        partyId: Number(r.party_id),
        name: String(r.name),
        village: String(r.village ?? ""),
        district: String(r.district ?? ""),
        landAcres: Number(r.land_acres ?? 0),
        crops,
      };
    }));
  });
}
