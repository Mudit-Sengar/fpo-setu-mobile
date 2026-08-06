import { withDb } from "../connection";
import { keyToThumb } from "../assets";
import type { CourseItem, FarmerScheme, Mentor, Scheme, Story, Thumb, Tier } from "../types";

/**
 * Static-ish content: schemes, courses, stories, partner/service directories.
 * Reads only — this content is seeded and not user-editable in the app today.
 */

/* ------------------------------------------------------------ schemes ---- */

export async function listFpoSchemes(): Promise<Scheme[]> {
  return withDb("listFpoSchemes", async (db) => {
    const rows = (await db.execute("SELECT * FROM schemes_fpo ORDER BY id;")).rows ?? [];
    return Promise.all(rows.map(async (r) => {
      const tiers = ((await db.execute(
        "SELECT tier FROM scheme_fpo_eligible_tiers WHERE scheme_id = ?;", [Number(r.id)])).rows ?? [])
        .map((t) => String(t.tier) as Tier);
      return {
        name: String(r.name),
        body: String(r.body) as Scheme["body"],
        desc: String(r.description ?? ""),
        eligibility: String(r.eligibility ?? ""),
        eligibleTiers: tiers,
        minMembers: r.min_members == null ? undefined : Number(r.min_members),
        minCompliance: r.min_compliance == null ? undefined : Number(r.min_compliance),
      };
    }));
  });
}

export async function listFarmerSchemes(body?: string): Promise<FarmerScheme[]> {
  return withDb("listFarmerSchemes", async (db) => {
    const sql = body == null
      ? "SELECT * FROM schemes_farmer ORDER BY id;"
      : "SELECT * FROM schemes_farmer WHERE body = ? ORDER BY id;";
    const rows = (await db.execute(sql, body == null ? [] : [body])).rows ?? [];

    return Promise.all(rows.map(async (r) => {
      const requirements = ((await db.execute(
        "SELECT requirement FROM farmer_scheme_requirements WHERE scheme_id = ? ORDER BY sort_order;",
        [Number(r.id)])).rows ?? []).map((x) => String(x.requirement));
      return {
        name: String(r.name),
        body: String(r.body) as FarmerScheme["body"],
        desc: String(r.description ?? ""),
        benefit: String(r.benefit ?? ""),
        requirements,
      };
    }));
  });
}

export async function getFarmerSchemeUrl(name: string): Promise<string | undefined> {
  return withDb("getFarmerSchemeUrl", async (db) => {
    const rows = (await db.execute("SELECT url FROM schemes_farmer WHERE name = ?;", [name])).rows ?? [];
    const url = rows[0]?.url;
    return url == null ? undefined : String(url);
  });
}

/* ------------------------------------------------------------ courses ---- */

export interface CourseRow extends CourseItem { duration?: string; transcript?: string }

export async function listCourses(category: "farmer" | "value" | "mgmt"): Promise<CourseRow[]> {
  return withDb("listCourses", async (db) => {
    const rows = (await db.execute(
      "SELECT * FROM courses WHERE category = ? ORDER BY id;", [category])).rows ?? [];
    return rows.map((r) => ({
      name: String(r.name),
      by: r.by == null ? undefined : String(r.by),
      progress: Number(r.progress ?? 0),
      thumb: keyToThumb(String(r.thumb_key ?? "")) as Thumb,
      duration: r.duration == null ? undefined : String(r.duration),
      transcript: r.transcript == null ? undefined : String(r.transcript),
    }));
  });
}

export async function listStories(): Promise<Story[]> {
  return withDb("listStories", async (db) => {
    const rows = (await db.execute("SELECT * FROM stories ORDER BY id;")).rows ?? [];
    return rows.map((r) => ({
      title: String(r.title),
      duration: String(r.duration ?? ""),
      transcript: String(r.transcript ?? ""),
      thumbKey: String(r.thumb_key ?? ""),
    }));
  });
}

/* ------------------------------------------------ partners & services ---- */

export interface NamedRow { name: string; [k: string]: string }

export async function listLenders(): Promise<{ name: string; eligibility: string; product: string }[]> {
  return withDb("listLenders", async (db) => {
    const rows = (await db.execute("SELECT * FROM lenders ORDER BY id;")).rows ?? [];
    return rows.map((r) => ({
      name: String(r.name),
      eligibility: String(r.eligibility ?? ""),
      product: String(r.product ?? ""),
    }));
  });
}

export async function listLogisticsProviders(): Promise<
  { name: string; svc: string; location: string; phone: string; email: string }[]
> {
  return withDb("listLogisticsProviders", async (db) => {
    const rows = (await db.execute("SELECT * FROM logistics_providers ORDER BY id;")).rows ?? [];
    return rows.map((r) => ({
      name: String(r.name),
      svc: String(r.svc ?? ""),
      location: String(r.location ?? ""),
      phone: String(r.phone ?? ""),
      email: String(r.email ?? ""),
    }));
  });
}

export async function listCompliancePartners(): Promise<{ name: string; svc: string; fee: string }[]> {
  return withDb("listCompliancePartners", async (db) => {
    const rows = (await db.execute("SELECT * FROM compliance_partners ORDER BY id;")).rows ?? [];
    return rows.map((r) => ({
      name: String(r.name),
      svc: String(r.svc ?? ""),
      fee: String(r.fee ?? ""),
    }));
  });
}

export async function listComplianceExplainer(): Promise<{ title: string; detail: string }[]> {
  return withDb("listComplianceExplainer", async (db) => {
    const rows = (await db.execute("SELECT * FROM compliance_explainer ORDER BY id;")).rows ?? [];
    return rows.map((r) => ({ title: String(r.title), detail: String(r.detail ?? "") }));
  });
}

export async function listExperts(): Promise<
  { name: string; role: string; note: string; phone: string; email: string }[]
> {
  return withDb("listExperts", async (db) => {
    const rows = (await db.execute("SELECT * FROM experts ORDER BY id;")).rows ?? [];
    return rows.map((r) => ({
      name: String(r.name),
      role: String(r.role ?? ""),
      note: String(r.note ?? ""),
      phone: String(r.phone ?? ""),
      email: String(r.email ?? ""),
    }));
  });
}

export async function listMentors(): Promise<Mentor[]> {
  return withDb("listMentors", async (db) => {
    const rows = (await db.execute("SELECT * FROM mentors ORDER BY id;")).rows ?? [];
    return rows.map((r) => ({
      name: String(r.name),
      expertise: String(r.expertise ?? ""),
      org: String(r.org ?? ""),
      phone: String(r.phone ?? ""),
      email: String(r.email ?? ""),
    }));
  });
}

export async function listSellerFeedback(fpoId: string): Promise<
  { buyer: string; commodity: string; qty_mt: number; date: string; stars: number; note: string }[]
> {
  return withDb("listSellerFeedback", async (db) => {
    const rows = (await db.execute(
      "SELECT * FROM seller_feedback WHERE fpo_id = ? ORDER BY id;", [fpoId])).rows ?? [];
    return rows.map((r) => ({
      buyer: String(r.buyer),
      commodity: String(r.commodity ?? ""),
      qty_mt: Number(r.qty_mt ?? 0),
      date: String(r.date ?? ""),
      stars: Number(r.stars ?? 0),
      note: String(r.note ?? ""),
    }));
  });
}
