import type { DB } from "@op-engineering/op-sqlite";
import {
  BUYERS, COMPLIANCE_EXPLAINER, COMPLIANCE_PARTNERS, DAILY_APMC_PRICES, EXPERTS,
  FARMER_COURSES, FARMER_SCHEMES, FARMERS, FPO_CUMULATIVE,
  FPO_MEETINGS, FPOS, GOVT_SCHEMES, GOVT_SCHEME_URLS, INPUT_NEEDS, LEDGER, LENDERS, LOGISTICS_PROVIDERS,
  MEMBER_ENGAGEMENT, MENTORS, MGMT_COURSES, PRICE_HISTORY, SELLER_FEEDBACK,
  SIMILAR_FARMERS, SUPPLIER_POSTINGS, SUPPLIERS, TIER_SCORES, VALUE_COURSES,
  farmerSchemeUrl, tierOpportunities, type Tier,
} from "../lib/mockData";
import { thumbToKey } from "./assets";

/**
 * One-time seeding of the database from the original mock arrays.
 *
 * mockData.ts is now ONLY a seed source — screens read through the repositories.
 * Seeding is guarded on the `fpos` table being empty, so a second launch is a
 * no-op and user-created rows (meetings, ledger entries, demands…) survive.
 */

const TIERS: Tier[] = ["Tier 1", "Tier 2", "Tier 3"];

/**
 * Success stories that previously lived as a local array in LearnScreen.tsx —
 * copied verbatim so nothing on screen changes.
 */
const STORIES = [
  {
    title: "Success Story — Ravindra from Akole",
    duration: "4:08",
    transcript: "Ravindra earned ₹38,000 extra in one season by selling 80 quintals of onion through Samruddha FPO, thanks to grading and direct processor linkage.",
    thumbKey: "asset:farmer-male",
  },
  {
    title: "Learn from Gayatri Devi from Pune",
    duration: "3:50",
    transcript: "Gayatri Devi led a women-only FPO in Pune that scaled from 40 to 220 members in 18 months by focusing on vegetables, packaging, and HORECA buyers.",
    thumbKey: "asset:farmer-female",
  },
];

/** Reference lists that were duplicated inline across the buyer/farmer screens. */
const LOOKUPS: { kind: string; values: string[] }[] = [
  { kind: "commodity", values: ["Wheat", "Rice", "Maize", "Soybean", "Onion", "Tomato", "Turmeric", "Cotton", "Sugarcane", "Pulses", "Tur", "Banana", "Mosambi", "Gram", "Other"] },
  { kind: "season", values: ["Kharif", "Rabi", "Zaid", "Year-round"] },
  { kind: "state", values: ["Maharashtra", "MP", "Gujarat", "Karnataka", "UP", "Punjab", "Haryana", "Rajasthan", "AP", "Telangana", "TN", "WB"] },
  { kind: "certification", values: ["Organic", "Global GAP", "FSSAI", "ISO", "APEDA"] },
  { kind: "crop", values: ["Onion", "Tomato", "Turmeric", "Soybean", "Tur", "Banana"] },
];

/** True when the database has never been seeded. */
async function isEmpty(db: DB): Promise<boolean> {
  const res = await db.execute("SELECT COUNT(*) AS n FROM fpos;");
  return Number(res.rows?.[0]?.n ?? 0) === 0;
}

export async function seedIfEmpty(db: DB): Promise<void> {
  if (!(await isEmpty(db))) return;

  // One transaction for the whole seed — a half-seeded database would render
  // screens with silently missing sections.
  await db.transaction(async (tx) => {
    const run = (sql: string, params: (string | number | null)[] = []) => tx.execute(sql, params);

    /* ---------------------------------------------------------------- FPOs */
    for (const f of FPOS) {
      await run(
        `INSERT INTO fpos (id, name, district, block, reg_no, members, tier, tagline,
          warehouse_mt, processing_has, processing_type, avg_price_realisation, apmc_price,
          compliance_score, reputation, reviews, incorporated)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);`,
        [f.id, f.name, f.district, f.block, f.regNo, f.members, f.tier, f.tagline,
          f.warehouseMT, f.processing.has ? 1 : 0, f.processing.type ?? null,
          f.avgPriceRealisation, f.apmcPrice, f.complianceScore, f.reputation, f.reviews,
          f.incorporated],
      );
      for (const c of f.commodities) {
        await run(`INSERT OR IGNORE INTO fpo_commodities (fpo_id, commodity) VALUES (?,?);`, [f.id, c]);
      }
      for (const g of f.grades) {
        await run(`INSERT OR IGNORE INTO fpo_grades (fpo_id, grade) VALUES (?,?);`, [f.id, g]);
      }
      for (const s of f.supply) {
        await run(
          `INSERT INTO fpo_supply (fpo_id, commodity, qty_mt, grade, harvest_window) VALUES (?,?,?,?,?);`,
          [f.id, s.commodity, s.qty_mt, s.grade, s.harvest_window],
        );
      }
    }

    // Crop-wise landholding (explicit for fpo-1/fpo-2, derived for the rest).
    for (const [fpoId, cum] of Object.entries(FPO_CUMULATIVE)) {
      for (const c of cum.cropwise) {
        await run(`INSERT OR IGNORE INTO fpo_cropwise (fpo_id, crop, acres) VALUES (?,?,?);`,
          [fpoId, c.crop, c.acres]);
      }
    }

    // fpo_monthly_summary used to be seeded here with the same four numbers for
    // every FPO. It's no longer read at all — fpoRepository.getMonthlySummary
    // now computes "this month" live from farmer_txns/ledger_entries/orders.

    const defaultFpo = FPOS[0].id;

    for (const m of FPO_MEETINGS) {
      await run(`INSERT INTO fpo_meetings (fpo_id, date, time, agenda, venue) VALUES (?,?,?,?,?);`,
        [defaultFpo, m.date, m.time, m.agenda, m.venue]);
    }

    for (const e of LEDGER) {
      await run(
        `INSERT INTO ledger_entries (fpo_id, date, description, type, amount, balance, counterparty_id, ref_id)
         VALUES (?,?,?,?,?,?,?,?);`,
        [defaultFpo, e.date, e.desc, e.type, e.amount, e.balance, e.counterpartyId ?? null, e.refId ?? null],
      );
    }

    for (const n of INPUT_NEEDS) {
      await run(`INSERT INTO input_needs (fpo_id, item, category, qty, window, notes) VALUES (?,?,?,?,?,?);`,
        [defaultFpo, n.item, n.category, n.qty, n.window, n.notes ?? null]);
    }

    /* ------------------------------------------------------------- Farmers */
    for (const f of FARMERS) {
      await run(
        `INSERT INTO farmers (id, name, village, district, land_acres, fpo_id, share_pct,
          member_since, taluka, state, survey_no, khasra_no)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?);`,
        [f.id, f.name, f.village, f.district, f.landAcres, f.fpoId, f.sharePct,
          f.memberSince ?? null, "Akole", "Maharashtra", "127/3B", "KH-2024-00831"],
      );
      for (const c of f.crops) {
        await run(`INSERT OR IGNORE INTO farmer_crops (farmer_id, crop) VALUES (?,?);`, [f.id, c]);
      }
      for (const t of f.txns) {
        await run(
          `INSERT INTO farmer_txns (farmer_id, date, crop, qty_q, price, amount, ref_id) VALUES (?,?,?,?,?,?,?);`,
          [f.id, t.date, t.crop, t.qty_q, t.price, t.amount, t.refId ?? null],
        );
      }
    }

    for (const m of MEMBER_ENGAGEMENT) {
      await run(
        `INSERT INTO member_engagement (fpo_id, name, village, status, sold_through_fpo, trainings, last_txn)
         VALUES (?,?,?,?,?,?,?);`,
        [defaultFpo, m.name, m.village, m.status, m.soldThroughFPO, m.trainings, m.lastTxn],
      );
    }

    /* --------------------------------------------------- Buyers / suppliers */
    for (const b of BUYERS) {
      await run(
        `INSERT INTO buyers (id, name, type, category, typical_volume_mt, location, quality_specs, procurement_window)
         VALUES (?,?,?,?,?,?,?,?);`,
        [b.id, b.name, b.type, b.category, b.typicalVolumeMT, b.location, b.qualitySpecs, b.procurementWindow],
      );
      for (const c of b.commodities) {
        await run(`INSERT OR IGNORE INTO buyer_commodities (buyer_id, commodity) VALUES (?,?);`, [b.id, c]);
      }
    }

    for (const s of SUPPLIERS) {
      await run(
        `INSERT INTO suppliers (id, name, brand, products, price_range, certifications, regions,
          min_order, lead_time_days, seasons, location)
         VALUES (?,?,?,?,?,?,?,?,?,?,?);`,
        [s.id, s.name, s.brand, s.products, s.priceRange, s.certifications, s.regions,
          s.minOrder, s.leadTimeDays, s.seasons, s.location],
      );
      for (const c of s.categories) {
        await run(`INSERT OR IGNORE INTO supplier_categories (supplier_id, category) VALUES (?,?);`, [s.id, c]);
      }
    }

    for (const p of SUPPLIER_POSTINGS) {
      await run(
        `INSERT INTO supplier_postings (id, supplier_id, item, category, qty, price_per_unit, region, window)
         VALUES (?,?,?,?,?,?,?,?);`,
        [p.id, SUPPLIERS[0]?.id ?? null, p.item, p.category, p.qty, p.pricePerUnit, p.region, p.window],
      );
    }

    for (const f of SELLER_FEEDBACK) {
      await run(
        `INSERT INTO seller_feedback (fpo_id, buyer, commodity, qty_mt, date, stars, note) VALUES (?,?,?,?,?,?,?);`,
        [defaultFpo, f.buyer, f.commodity, f.qty_mt, f.date, f.stars, f.note],
      );
    }

    /* ---------------------------------------------------- Partners/services */
    for (const l of LENDERS) {
      await run(`INSERT INTO lenders (name, eligibility, product) VALUES (?,?,?);`, [l.name, l.eligibility, l.product]);
    }
    for (const p of LOGISTICS_PROVIDERS) {
      await run(`INSERT INTO logistics_providers (name, svc, location, phone, email) VALUES (?,?,?,?,?);`,
        [p.name, p.svc, p.location, p.phone, p.email]);
    }
    for (const p of COMPLIANCE_PARTNERS) {
      await run(`INSERT INTO compliance_partners (name, svc, fee) VALUES (?,?,?);`, [p.name, p.svc, p.fee]);
    }
    for (const c of COMPLIANCE_EXPLAINER) {
      await run(`INSERT INTO compliance_explainer (title, detail) VALUES (?,?);`, [c.title, c.detail]);
    }
    for (const e of EXPERTS) {
      await run(`INSERT INTO experts (name, role, note, phone, email) VALUES (?,?,?,?,?);`,
        [e.name, e.role, e.note, e.phone, e.email]);
    }
    for (const m of MENTORS) {
      await run(`INSERT INTO mentors (name, expertise, org, phone, email) VALUES (?,?,?,?,?);`,
        [m.name, m.expertise, m.org, m.phone, m.email]);
    }

    /* ------------------------------------------------------------- Schemes */
    for (const s of GOVT_SCHEMES) {
      const res = await run(
        `INSERT INTO schemes_fpo (name, body, description, eligibility, min_members, min_compliance, url)
         VALUES (?,?,?,?,?,?,?);`,
        [s.name, s.body, s.desc, s.eligibility, s.minMembers ?? null, s.minCompliance ?? null,
          GOVT_SCHEME_URLS[s.name] ?? null],
      );
      const schemeId = Number(res.insertId ?? 0);
      for (const t of s.eligibleTiers) {
        await run(`INSERT OR IGNORE INTO scheme_fpo_eligible_tiers (scheme_id, tier) VALUES (?,?);`, [schemeId, t]);
      }
    }

    for (const s of FARMER_SCHEMES) {
      const res = await run(
        `INSERT INTO schemes_farmer (name, body, description, benefit, url) VALUES (?,?,?,?,?);`,
        [s.name, s.body, s.desc, s.benefit, farmerSchemeUrl(s) ?? null],
      );
      const schemeId = Number(res.insertId ?? 0);
      for (let i = 0; i < s.requirements.length; i++) {
        await run(`INSERT INTO farmer_scheme_requirements (scheme_id, requirement, sort_order) VALUES (?,?,?);`,
          [schemeId, s.requirements[i], i]);
      }
    }

    /* ---------------------------------------------------- Learning content */
    for (const c of FARMER_COURSES) {
      await run(
        `INSERT INTO courses (category, name, by, progress, duration, transcript, thumb_key) VALUES (?,?,?,?,?,?,?);`,
        ["farmer", c.title, null, 0, c.duration, c.transcript, thumbToKey(c.thumb)],
      );
    }
    for (const c of VALUE_COURSES) {
      await run(
        `INSERT INTO courses (category, name, by, progress, duration, transcript, thumb_key) VALUES (?,?,?,?,?,?,?);`,
        ["value", c.name, c.by ?? null, c.progress, null, null, thumbToKey(c.thumb)],
      );
    }
    for (const c of MGMT_COURSES) {
      await run(
        `INSERT INTO courses (category, name, by, progress, duration, transcript, thumb_key) VALUES (?,?,?,?,?,?,?);`,
        ["mgmt", c.name, c.by ?? null, c.progress, null, null, thumbToKey(c.thumb)],
      );
    }
    for (const s of STORIES) {
      await run(`INSERT INTO stories (title, duration, transcript, thumb_key) VALUES (?,?,?,?);`,
        [s.title, s.duration, s.transcript, s.thumbKey]);
    }

    /* ------------------------------------------------ Tiers & opportunities */
    for (const tier of TIERS) {
      const t = TIER_SCORES[tier];
      await run(
        `INSERT INTO tier_scores (tier, financial, operational, infra, governance, market) VALUES (?,?,?,?,?,?);`,
        [tier, t.financial, t.operational, t.infra, t.governance, t.market],
      );

      const opps = tierOpportunities(tier);
      for (let i = 0; i < opps.length; i++) {
        const o = opps[i];
        const res = await run(
          `INSERT INTO tier_opportunities (tier, label, amount, action, investment, outcome, sort_order)
           VALUES (?,?,?,?,?,?,?);`,
          [tier, o.label, o.amount, o.action, o.investment, o.outcome, i],
        );
        const oppId = Number(res.insertId ?? 0);
        for (let j = 0; j < o.steps.length; j++) {
          await run(`INSERT INTO tier_opportunity_steps (opportunity_id, step, sort_order) VALUES (?,?,?);`,
            [oppId, o.steps[j], j]);
        }
      }
    }

    /* --------------------------------------------------------- Market data */
    for (const [crop, series] of Object.entries(DAILY_APMC_PRICES)) {
      for (const point of series) {
        await run(`INSERT OR IGNORE INTO daily_apmc_prices (crop, date, price) VALUES (?,?,?);`,
          [crop, point.date, point.price]);
      }
    }
    for (const p of PRICE_HISTORY) {
      await run(`INSERT INTO price_history (month, fpo, apmc) VALUES (?,?,?);`, [p.month, p.fpo, p.apmc]);
    }
    // The peer farmers seed as ordinary farmers. They used to go into a separate
    // `similar_farmers` display table, which meant they had no party and could
    // never receive a connection request or a message — see migration 010, which
    // promotes them on an existing install and then drops that table.
    for (const f of SIMILAR_FARMERS) {
      await run(
        `INSERT OR IGNORE INTO farmers (id, name, village, district, land_acres, state)
         VALUES (?,?,?,?,?,'Maharashtra');`,
        [f.id, f.name, f.village, f.district, f.landAcres],
      );
      if (f.crop) {
        await run("INSERT OR IGNORE INTO farmer_crops (farmer_id, crop) VALUES (?,?);", [f.id, f.crop]);
      }
    }

    /* ------------------------------------------------------------- Lookups */
    for (const l of LOOKUPS) {
      for (let i = 0; i < l.values.length; i++) {
        await run(`INSERT OR IGNORE INTO lookup_values (kind, value, sort_order) VALUES (?,?,?);`,
          [l.kind, l.values[i], i]);
      }
    }
  });
}
