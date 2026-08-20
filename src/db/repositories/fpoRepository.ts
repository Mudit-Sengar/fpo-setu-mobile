import { withDb, withWrite } from "../connection";
import { requireProfile, type SessionContext } from "../authz";
import type {
  FPO, FpoCumulative, FpoMeeting, FpoMonthlySummary, FPOSupply,
  LedgerEntry, MemberEngagement, OpportunityDetail, Tier,
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

export async function insertLedgerEntry(fpoId: string, e: LedgerEntry): Promise<void> {
  await withWrite("insertLedgerEntry", (db) =>
    db.execute(
      `INSERT INTO ledger_entries
         (fpo_id, date, description, type, amount, balance,
          counterparty_party_id, counterparty_label, order_id, ref_id)
       VALUES (?,?,?,?,?,?,?,?,?,?);`,
      [fpoId, e.date, e.desc, e.type, e.amount, e.balance,
        e.counterpartyPartyId ?? null, e.counterpartyLabel ?? null,
        e.orderId ?? null, e.refId ?? null],
    ));
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

    const fpoRows = (await db.execute("SELECT members FROM fpos WHERE id = ?;", [fpoId])).rows ?? [];
    const totalMembers = Number(fpoRows[0]?.members ?? 0);

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

export async function getMonthlySummary(fpoId: string): Promise<FpoMonthlySummary | null> {
  return withDb("getMonthlySummary", async (db) => {
    const rows = (await db.execute("SELECT * FROM fpo_monthly_summary WHERE fpo_id = ?;", [fpoId])).rows ?? [];
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      monthSoldQ: Number(r.month_sold_q ?? 0),
      sellPrice: Number(r.sell_price ?? 0),
      onwardPrice: Number(r.onward_price ?? 0),
      fpoProfit: Number(r.fpo_profit ?? 0),
    };
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
