import { withDb, withWrite } from "../connection";
import { AuthzError, requireProfile, type SessionContext } from "../authz";
import { countActiveMembers } from "./membershipRepository";
import type {
  FPO, FpoCumulative, FpoMeeting, FpoMonthlySummary, FPOSupply,
  LedgerEntry, MemberEngagement, NewLedgerEntry, OpportunityDetail, Tier,
} from "../types";

/** FPO entity + its child collections (supply, meetings, ledger, members). */

export async function listFpos(): Promise<FPO[]> {
  return withDb("listFpos", async (db) => {
    const rows = (await db.execute("SELECT * FROM fpos ORDER BY name;")).rows ?? [];
    return Promise.all(rows.map((r) => hydrateFpo(r)));
  });
}

export async function getFpoById(id: string): Promise<FPO | null> {
  return withDb("getFpoById", async (db) => {
    const rows = (await db.execute("SELECT * FROM fpos WHERE id = ?;", [id])).rows ?? [];
    if (rows.length === 0) return null;
    return hydrateFpo(rows[0]);
  });
}

/** Joins the normalised child tables back into the FPO shape the screens expect. */
async function hydrateFpo(r: Record<string, unknown>): Promise<FPO> {
  return withDb("hydrateFpo", async (db) => {
    const id = String(r.id);
    const commodities = ((await db.execute("SELECT commodity FROM fpo_commodities WHERE fpo_id = ?;", [id])).rows ?? [])
      .map((x) => String(x.commodity));
    const grades = ((await db.execute("SELECT grade FROM fpo_grades WHERE fpo_id = ?;", [id])).rows ?? [])
      .map((x) => String(x.grade));
    // Supply now comes from `requests`, not the retired `fpo_supply` table: what
    // an FPO can supply IS a standing set of open supply requests, and reading it
    // from one place is what lets a buyer respond to the very row shown here.
    const supply = ((await db.execute(
      `SELECT r.item, r.qty, r.grade, r.window_label
         FROM requests r
         JOIN parties p ON p.id = r.author_party_id
        WHERE p.kind = 'fpo' AND p.entity_id = ?
          AND r.kind = 'commodity_supply' AND r.status = 'open'
        ORDER BY r.id;`, [id])).rows ?? []).map(toSupply);

    return {
      id,
      name: String(r.name),
      district: String(r.district ?? ""),
      block: String(r.block ?? ""),
      regNo: String(r.reg_no ?? ""),
      commodities,
      members: Number(r.members ?? 0),
      tier: String(r.tier ?? "Tier 3") as Tier,
      tagline: String(r.tagline ?? ""),
      warehouseMT: Number(r.warehouse_mt ?? 0),
      processing: {
        has: Number(r.processing_has ?? 0) === 1,
        type: r.processing_type == null ? undefined : String(r.processing_type),
      },
      grades,
      avgPriceRealisation: Number(r.avg_price_realisation ?? 0),
      apmcPrice: Number(r.apmc_price ?? 0),
      complianceScore: Number(r.compliance_score ?? 0),
      reputation: Number(r.reputation ?? 0),
      reviews: Number(r.reviews ?? 0),
      supply,
      incorporated: String(r.incorporated ?? ""),
    };
  });
}

/* ------------------------------------------------------------- profile ---- */

/**
 * The editable half of an FPO's own record.
 *
 * District and block are separate here even though the screen used to show them
 * as one "District / Block" field: joining them for display was fine, splitting
 * a user-typed string back apart on a slash was not.
 */
export interface FpoProfileUpdate {
  name: string;
  regNo: string;
  district: string;
  block: string;
  incorporated: string;
  warehouseMT: number;
  processingHas: boolean;
  processingType: string | null;
}

/**
 * Saves the signed-in FPO's own details.
 *
 * Takes no id — the target comes from the session, so this cannot be pointed at
 * another organisation. Aggregate columns (members, tier, compliance, reputation)
 * are deliberately not writable here: they are derived or externally assessed,
 * and the screen does not offer them.
 */
export async function updateFpoProfile(ctx: SessionContext | null, input: FpoProfileUpdate): Promise<void> {
  const fpoId = requireProfile(ctx, "fpo");
  await withWrite("updateFpoProfile", (db) => db.execute(
    `UPDATE fpos SET name = ?, reg_no = ?, district = ?, block = ?, incorporated = ?,
                     warehouse_mt = ?, processing_has = ?, processing_type = ?
       WHERE id = ?;`,
    [
      input.name, input.regNo, input.district, input.block, input.incorporated,
      input.warehouseMT, input.processingHas ? 1 : 0, input.processingType,
      fpoId,
    ],
  ));
}

/** Rows come from `requests` now; the FPOSupply shape is unchanged for screens. */
const toSupply = (r: Record<string, unknown>): FPOSupply => ({
  commodity: String(r.item),
  qty_mt: Number(r.qty ?? 0),
  grade: String(r.grade ?? ""),
  harvest_window: String(r.window_label ?? ""),
});

/*
 * NOTE: listSupply / insertSupply / listInputNeeds / insertInputNeed used to live
 * here, reading and writing `fpo_supply` and `input_needs`. Both are now kinds of
 * `requests` — see src/db/repositories/requestRepository.ts. Keeping thin
 * forwarding wrappers here would have hidden the fact that these postings now
 * have an author, a status and an audience, so the call sites moved instead.
 */

/* ---------------------------------------------------------- meetings ---- */

/** A meeting plus how many members were invited to it. */
export interface FpoMeetingRow extends FpoMeeting {
  id: number;
  invitedCount: number;
}

export async function listMeetings(fpoId: string): Promise<FpoMeetingRow[]> {
  return withDb("listMeetings", async (db) => {
    const rows = (await db.execute(
      `SELECT m.*, (SELECT COUNT(*) FROM meeting_invitations i WHERE i.meeting_id = m.id) AS invited_count
         FROM fpo_meetings m WHERE m.fpo_id = ? ORDER BY m.id DESC;`, [fpoId])).rows ?? [];
    return rows.map((r) => ({
      id: Number(r.id),
      date: String(r.date),
      time: String(r.time ?? ""),
      agenda: String(r.agenda ?? ""),
      venue: String(r.venue ?? ""),
      invitedCount: Number(r.invited_count ?? 0),
    }));
  });
}

/** Logs a meeting and returns its id, so invitations can be sent against it. */
export async function insertMeeting(fpoId: string, m: FpoMeeting): Promise<number> {
  return withWrite("insertMeeting", async (db) => {
    await db.execute("INSERT INTO fpo_meetings (fpo_id, date, time, agenda, venue) VALUES (?,?,?,?,?);",
      [fpoId, m.date, m.time, m.agenda, m.venue]);
    const rows = (await db.execute(
      "SELECT id FROM fpo_meetings WHERE fpo_id = ? ORDER BY id DESC LIMIT 1;", [fpoId])).rows ?? [];
    return Number(rows[0]?.id ?? 0);
  });
}

/**
 * Deletes a logged meeting. `meeting_invitations` for it go with it —
 * `ON DELETE CASCADE` in migration 006 — so no invitation is left pointing at a
 * meeting that no longer exists.
 */
export async function deleteMeeting(ctx: SessionContext | null, fpoId: string, meetingId: number): Promise<void> {
  const ownFpoId = requireProfile(ctx, "fpo");
  if (ownFpoId !== fpoId) throw new AuthzError("That meeting belongs to another FPO.");

  await withWrite("deleteMeeting", async (db) => {
    const rows = (await db.execute(
      "SELECT 1 AS ok FROM fpo_meetings WHERE id = ? AND fpo_id = ?;", [meetingId, fpoId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That meeting no longer exists.");
    await db.execute("DELETE FROM fpo_meetings WHERE id = ?;", [meetingId]);
  });
}

/* ------------------------------------------------------------ ledger ---- */

export async function listLedger(fpoId: string): Promise<LedgerEntry[]> {
  return withDb("listLedger", async (db) => {
    // The counterparty name is joined rather than stored, so renaming a buyer
    // renames it everywhere instead of leaving old entries with a stale copy.
    const rows = (await db.execute(
      `SELECT l.*, v.name AS counterparty_name
         FROM ledger_entries l
         LEFT JOIN v_parties v ON v.party_id = l.counterparty_party_id
        WHERE l.fpo_id = ? ORDER BY l.id;`, [fpoId])).rows ?? [];
    return rows.map((r) => ({
      id: Number(r.id),
      date: String(r.date),
      desc: String(r.description ?? ""),
      type: String(r.type) as LedgerEntry["type"],
      amount: Number(r.amount ?? 0),
      balance: Number(r.balance ?? 0),
      counterpartyPartyId: r.counterparty_party_id == null ? null : Number(r.counterparty_party_id),
      counterpartyLabel: r.counterparty_label == null ? null : String(r.counterparty_label),
      counterpartyName: String(r.counterparty_name ?? ""),
      orderId: r.order_id == null ? null : Number(r.order_id),
      refId: r.ref_id == null ? undefined : String(r.ref_id),
    }));
  });
}

/** Inserts a ledger entry and returns its id, so a manual procurement entry can link the farmer transaction it implies — see `farmerRepository.recordFarmerTransaction`. */
export async function insertLedgerEntry(fpoId: string, e: NewLedgerEntry): Promise<number> {
  return withWrite("insertLedgerEntry", async (db) => {
    await db.execute(
      `INSERT INTO ledger_entries
         (fpo_id, date, description, type, amount, balance,
          counterparty_party_id, counterparty_label, order_id, ref_id)
       VALUES (?,?,?,?,?,?,?,?,?,?);`,
      [fpoId, e.date, e.desc, e.type, e.amount, e.balance,
        e.counterpartyPartyId ?? null, e.counterpartyLabel ?? null,
        e.orderId ?? null, e.refId ?? null],
    );
    const rows = (await db.execute(
      "SELECT id FROM ledger_entries WHERE fpo_id = ? ORDER BY id DESC LIMIT 1;", [fpoId])).rows ?? [];
    return Number(rows[0]?.id ?? 0);
  });
}

/**
 * Deletes one ledger entry.
 *
 * A manually-recorded farmer transaction posted alongside it goes too —
 * `farmer_txns.ledger_entry_id ON DELETE CASCADE`, migration 014 — so the
 * farmer's own history does not keep showing a produce transaction whose
 * bookkeeping entry the FPO removed.
 *
 * Every later entry's stored `balance` included this one's amount, so the
 * running total is replayed from scratch over what remains rather than left
 * stale.
 */
export async function deleteLedgerEntry(ctx: SessionContext | null, fpoId: string, entryId: number): Promise<void> {
  const ownFpoId = requireProfile(ctx, "fpo");
  if (ownFpoId !== fpoId) throw new AuthzError("That ledger belongs to another FPO.");

  await withWrite("deleteLedgerEntry", async (db) => {
    const rows = (await db.execute(
      "SELECT 1 AS ok FROM ledger_entries WHERE id = ? AND fpo_id = ?;", [entryId, fpoId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That ledger entry no longer exists.");

    await db.execute("DELETE FROM ledger_entries WHERE id = ?;", [entryId]);

    const remaining = (await db.execute(
      "SELECT id, type, amount FROM ledger_entries WHERE fpo_id = ? ORDER BY id;", [fpoId])).rows ?? [];
    let running = 0;
    for (const r of remaining) {
      running = String(r.type) === "Income" ? running + Number(r.amount) : running - Number(r.amount);
      await db.execute("UPDATE ledger_entries SET balance = ? WHERE id = ?;", [running, Number(r.id)]);
    }
  });
}

/** The linked farmer transaction's crop/quantity for a ledger entry, if any — see migration 014. */
export async function getFarmerTxnForLedgerEntry(
  entryId: number,
): Promise<{ crop: string; qtyQ: number } | null> {
  return withDb("getFarmerTxnForLedgerEntry", async (db) => {
    const rows = (await db.execute(
      "SELECT crop, qty_q FROM farmer_txns WHERE ledger_entry_id = ? LIMIT 1;", [entryId])).rows ?? [];
    if (rows.length === 0) return null;
    return { crop: String(rows[0].crop ?? ""), qtyQ: Number(rows[0].qty_q ?? 0) };
  });
}

export interface LedgerEntryEdit {
  date: string;
  desc: string;
  type: "Income" | "Expense";
  amount: number;
  counterpartyPartyId?: number | null;
  counterpartyLabel?: string | null;
  /** Set to sync a linked farmer transaction's crop/quantity too (see migration 014). */
  farmerCrop?: string;
  farmerQtyQ?: number;
}

/**
 * Edits a ledger entry in place.
 *
 * Every later entry's stored `balance` was computed against this one's old
 * amount, so the running total is replayed from scratch afterwards — same as
 * `deleteLedgerEntry`. If a farmer transaction was posted alongside this entry
 * (migration 014), its date/amount/price move with the edit too, so the
 * farmer's own "My FPO" transaction history and this-month totals stay in sync
 * instead of drifting from what the FPO's books now say.
 */
export async function updateLedgerEntry(
  ctx: SessionContext | null, fpoId: string, entryId: number, edit: LedgerEntryEdit,
): Promise<void> {
  const ownFpoId = requireProfile(ctx, "fpo");
  if (ownFpoId !== fpoId) throw new AuthzError("That ledger belongs to another FPO.");

  await withWrite("updateLedgerEntry", async (db) => {
    const rows = (await db.execute(
      "SELECT 1 AS ok FROM ledger_entries WHERE id = ? AND fpo_id = ?;", [entryId, fpoId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That ledger entry no longer exists.");

    await db.execute(
      `UPDATE ledger_entries SET date = ?, description = ?, type = ?, amount = ?,
              counterparty_party_id = ?, counterparty_label = ? WHERE id = ?;`,
      [edit.date, edit.desc, edit.type, edit.amount,
        edit.counterpartyPartyId ?? null, edit.counterpartyLabel ?? null, entryId]);

    const remaining = (await db.execute(
      "SELECT id, type, amount FROM ledger_entries WHERE fpo_id = ? ORDER BY id;", [fpoId])).rows ?? [];
    let running = 0;
    for (const r of remaining) {
      running = String(r.type) === "Income" ? running + Number(r.amount) : running - Number(r.amount);
      await db.execute("UPDATE ledger_entries SET balance = ? WHERE id = ?;", [running, Number(r.id)]);
    }

    const linked = (await db.execute(
      "SELECT qty_q FROM farmer_txns WHERE ledger_entry_id = ?;", [entryId])).rows ?? [];
    if (linked.length > 0) {
      const qty = edit.farmerQtyQ ?? Number(linked[0].qty_q ?? 0);
      const price = qty > 0 ? Math.round(edit.amount / qty) : 0;
      if (edit.farmerCrop != null) {
        await db.execute(
          "UPDATE farmer_txns SET date = ?, amount = ?, qty_q = ?, price = ?, crop = ? WHERE ledger_entry_id = ?;",
          [edit.date, edit.amount, qty, price, edit.farmerCrop, entryId]);
      } else {
        await db.execute(
          "UPDATE farmer_txns SET date = ?, amount = ?, qty_q = ?, price = ? WHERE ledger_entry_id = ?;",
          [edit.date, edit.amount, qty, price, entryId]);
      }
    }
  });
}

/* -------------------------------------------------------- engagement ---- */

export async function listMemberEngagement(fpoId: string): Promise<MemberEngagement[]> {
  return withDb("listMemberEngagement", async (db) => {
    const rows = (await db.execute("SELECT * FROM member_engagement WHERE fpo_id = ? ORDER BY id;", [fpoId])).rows ?? [];
    return rows.map((r) => ({
      name: String(r.name),
      village: String(r.village ?? ""),
      status: String(r.status) as MemberEngagement["status"],
      soldThroughFPO: Number(r.sold_through_fpo ?? 0),
      trainings: Number(r.trainings ?? 0),
      lastTxn: String(r.last_txn ?? ""),
    }));
  });
}

/* -------------------------------------------------------- aggregates ---- */

export async function cumulativeFor(fpoId: string): Promise<FpoCumulative> {
  return withDb("cumulativeFor", async (db) => {
    const cropRows = (await db.execute(
      "SELECT crop, acres FROM fpo_cropwise WHERE fpo_id = ? ORDER BY acres DESC;", [fpoId])).rows ?? [];

    // Real active-membership count, not the frozen seeded `fpos.members` column
    // — the same reason MeetingSection reads it this way.
    const totalMembers = await countActiveMembers(fpoId);

    // Explicit crop-wise data exists for a couple of FPOs; the rest are derived
    // the same way the old cumulativeFor() helper did.
    const cropwise = cropRows.map((r) => ({ crop: String(r.crop), acres: Number(r.acres ?? 0) }));
    const totalLandAcres = cropwise.length > 0
      ? cropwise.reduce((sum, c) => sum + c.acres, 0)
      : Math.round(totalMembers * 1.8);

    if (cropwise.length === 0) {
      const commodities = ((await db.execute(
        "SELECT commodity FROM fpo_commodities WHERE fpo_id = ?;", [fpoId])).rows ?? [])
        .map((r) => String(r.commodity));
      const per = commodities.length > 0 ? Math.round(totalLandAcres / commodities.length) : 0;
      return { totalMembers, totalLandAcres, cropwise: commodities.map((crop) => ({ crop, acres: per })) };
    }

    return { totalMembers, totalLandAcres, cropwise };
  });
}

/**
 * This farmer's "this month" standing with an FPO, computed live from the
 * transaction data itself rather than read out of a frozen `fpo_monthly_summary`
 * row (that table was seeded with the same four numbers for every FPO — see the
 * removed insert in seed.ts).
 *
 * `monthSoldQ`/`sellPrice` are this farmer's own `farmer_txns` for the month —
 * the same rows Digital Bookkeeping posts via `recordFarmerTransaction`, so an
 * FPO logging, editing or deleting an entry changes what this returns.
 * `fpoProfit` is the FPO's actual ledger (Income − Expense) for the month.
 * `onwardPrice` is the FPO's average sale price on its own `orders` as seller
 * this month, falling back to its all-time `avg_price_realisation` when it has
 * not sold anything onward yet this month.
 */
export async function getMonthlySummary(
  fpoId: string, farmerId: string | null,
): Promise<FpoMonthlySummary | null> {
  return withDb("getMonthlySummary", async (db) => {
    const farmerRows = farmerId == null ? [] : (await db.execute(
      `SELECT COALESCE(SUM(t.qty_q), 0) AS qty, COALESCE(SUM(t.amount), 0) AS sales
         FROM farmer_txns t
         JOIN memberships m ON m.id = t.membership_id
        WHERE m.fpo_id = ? AND t.farmer_id = ?
          AND strftime('%Y-%m', t.date) = strftime('%Y-%m', 'now');`,
      [fpoId, farmerId])).rows ?? [];
    const monthSoldQ = Number(farmerRows[0]?.qty ?? 0);
    const sales = Number(farmerRows[0]?.sales ?? 0);
    const sellPrice = monthSoldQ > 0 ? Math.round(sales / monthSoldQ) : 0;

    const profitRows = (await db.execute(
      `SELECT COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END), 0) -
              COALESCE(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END), 0) AS profit
         FROM ledger_entries
        WHERE fpo_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now');`,
      [fpoId])).rows ?? [];
    const fpoProfit = Number(profitRows[0]?.profit ?? 0);

    const onwardRows = (await db.execute(
      `SELECT COALESCE(SUM(o.qty), 0) AS qty, COALESCE(SUM(o.total_amount), 0) AS amt
         FROM orders o
         JOIN parties p ON p.id = o.seller_party_id
        WHERE p.kind = 'fpo' AND p.entity_id = ?
          AND o.status IN ('delivered', 'paid')
          AND strftime('%Y-%m', COALESCE(o.paid_at, o.delivered_at, o.created_at)) = strftime('%Y-%m', 'now');`,
      [fpoId])).rows ?? [];
    const onwardQty = Number(onwardRows[0]?.qty ?? 0);
    const onwardAmt = Number(onwardRows[0]?.amt ?? 0);
    const onwardPrice = onwardQty > 0
      ? Math.round(onwardAmt / onwardQty)
      : Number((await db.execute(
          "SELECT avg_price_realisation FROM fpos WHERE id = ?;", [fpoId])).rows?.[0]?.avg_price_realisation ?? 0);

    return { monthSoldQ, sellPrice, onwardPrice, onwardTotal: onwardAmt, fpoProfit };
  });
}

/* ------------------------------------------------------ tier scoring ---- */

export async function getTierScores(tier: Tier): Promise<Record<string, number>> {
  return withDb("getTierScores", async (db) => {
    const rows = (await db.execute("SELECT * FROM tier_scores WHERE tier = ?;", [tier])).rows ?? [];
    const r = rows[0] ?? {};
    return {
      financial: Number(r.financial ?? 0),
      operational: Number(r.operational ?? 0),
      infra: Number(r.infra ?? 0),
      governance: Number(r.governance ?? 0),
      market: Number(r.market ?? 0),
    };
  });
}

export async function getTierOpportunities(tier: Tier): Promise<OpportunityDetail[]> {
  return withDb("getTierOpportunities", async (db) => {
    const opps = (await db.execute(
      "SELECT * FROM tier_opportunities WHERE tier = ? ORDER BY sort_order;", [tier])).rows ?? [];

    return Promise.all(opps.map(async (o) => {
      const steps = ((await db.execute(
        "SELECT step FROM tier_opportunity_steps WHERE opportunity_id = ? ORDER BY sort_order;",
        [Number(o.id)])).rows ?? []).map((s) => String(s.step));

      return {
        label: String(o.label),
        amount: String(o.amount ?? ""),
        action: String(o.action ?? ""),
        steps,
        investment: String(o.investment ?? ""),
        outcome: String(o.outcome ?? ""),
      };
    }));
  });
}
