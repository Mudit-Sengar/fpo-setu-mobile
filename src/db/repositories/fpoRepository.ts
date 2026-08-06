import { withDb } from "../connection";
import type {
  FPO, FpoCumulative, FpoMeeting, FpoMonthlySummary, FPOSupply, InputNeed,
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
    const supply = ((await db.execute("SELECT * FROM fpo_supply WHERE fpo_id = ?;", [id])).rows ?? [])
      .map(toSupply);

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

const toSupply = (r: Record<string, unknown>): FPOSupply => ({
  commodity: String(r.commodity),
  qty_mt: Number(r.qty_mt ?? 0),
  grade: String(r.grade ?? ""),
  harvest_window: String(r.harvest_window ?? ""),
});

/* ------------------------------------------------------------ supply ---- */

export async function listSupply(fpoId: string): Promise<FPOSupply[]> {
  return withDb("listSupply", async (db) => {
    const rows = (await db.execute("SELECT * FROM fpo_supply WHERE fpo_id = ? ORDER BY id;", [fpoId])).rows ?? [];
    return rows.map(toSupply);
  });
}

export async function insertSupply(fpoId: string, s: FPOSupply): Promise<void> {
  await withDb("insertSupply", (db) =>
    db.execute(
      "INSERT INTO fpo_supply (fpo_id, commodity, qty_mt, grade, harvest_window) VALUES (?,?,?,?,?);",
      [fpoId, s.commodity, s.qty_mt, s.grade, s.harvest_window],
    ));
}

/* ------------------------------------------------------- input needs ---- */

export async function listInputNeeds(fpoId: string): Promise<InputNeed[]> {
  return withDb("listInputNeeds", async (db) => {
    const rows = (await db.execute("SELECT * FROM input_needs WHERE fpo_id = ? ORDER BY id;", [fpoId])).rows ?? [];
    return rows.map((r) => ({
      item: String(r.item),
      category: String(r.category ?? ""),
      qty: String(r.qty ?? ""),
      window: String(r.window ?? ""),
      notes: r.notes == null ? undefined : String(r.notes),
    }));
  });
}

export async function insertInputNeed(fpoId: string, n: InputNeed): Promise<void> {
  await withDb("insertInputNeed", (db) =>
    db.execute(
      "INSERT INTO input_needs (fpo_id, item, category, qty, window, notes) VALUES (?,?,?,?,?,?);",
      [fpoId, n.item, n.category, n.qty, n.window, n.notes ?? null],
    ));
}

/* ---------------------------------------------------------- meetings ---- */

export async function listMeetings(fpoId: string): Promise<FpoMeeting[]> {
  return withDb("listMeetings", async (db) => {
    const rows = (await db.execute("SELECT * FROM fpo_meetings WHERE fpo_id = ? ORDER BY id DESC;", [fpoId])).rows ?? [];
    return rows.map((r) => ({
      date: String(r.date),
      time: String(r.time ?? ""),
      agenda: String(r.agenda ?? ""),
      venue: String(r.venue ?? ""),
    }));
  });
}

export async function insertMeeting(fpoId: string, m: FpoMeeting): Promise<void> {
  await withDb("insertMeeting", (db) =>
    db.execute("INSERT INTO fpo_meetings (fpo_id, date, time, agenda, venue) VALUES (?,?,?,?,?);",
      [fpoId, m.date, m.time, m.agenda, m.venue]));
}

/* ------------------------------------------------------------ ledger ---- */

export async function listLedger(fpoId: string): Promise<LedgerEntry[]> {
  return withDb("listLedger", async (db) => {
    const rows = (await db.execute("SELECT * FROM ledger_entries WHERE fpo_id = ? ORDER BY id;", [fpoId])).rows ?? [];
    return rows.map((r) => ({
      date: String(r.date),
      desc: String(r.description ?? ""),
      type: String(r.type) as LedgerEntry["type"],
      amount: Number(r.amount ?? 0),
      balance: Number(r.balance ?? 0),
      counterpartyId: r.counterparty_id == null ? undefined : String(r.counterparty_id),
      refId: r.ref_id == null ? undefined : String(r.ref_id),
    }));
  });
}

export async function insertLedgerEntry(fpoId: string, e: LedgerEntry): Promise<void> {
  await withDb("insertLedgerEntry", (db) =>
    db.execute(
      `INSERT INTO ledger_entries (fpo_id, date, description, type, amount, balance, counterparty_id, ref_id)
       VALUES (?,?,?,?,?,?,?,?);`,
      [fpoId, e.date, e.desc, e.type, e.amount, e.balance, e.counterpartyId ?? null, e.refId ?? null],
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
