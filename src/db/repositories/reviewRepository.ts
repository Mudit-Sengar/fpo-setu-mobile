import { withDb, withWrite } from "../connection";
import { AuthzError, type SessionContext } from "../authz";
import { notifyParty } from "./networkRepository";

/**
 * Ratings that are evidence of a trade.
 *
 * The old flow let a buyer pick any FPO from a dropdown and rate it, repeatedly,
 * with no record of who had rated. A review now requires an order the author was
 * a party to, which has reached delivered or paid — and one review per order per
 * author, enforced by a partial unique index rather than by the screen.
 *
 * Reviews are bidirectional: an FPO can rate a buyer who paid late just as a
 * buyer can rate an FPO whose grading slipped.
 */

export interface ReviewRow {
  id: number;
  authorPartyId: number;
  authorName: string;
  subjectPartyId: number;
  orderId: number | null;
  orderNo: string;
  commodity: string;
  qty: number;
  unit: string;
  quality: number;
  delivery: number;
  communication: number;
  note: string;
  createdAt: string;
}

export interface Reputation {
  rating: number;
  reviewCount: number;
}

const REVIEW_SELECT = `
  SELECT r.*, v.name AS author_name,
         o.order_no, o.commodity, o.qty, o.unit
    FROM reviews_v2 r
    JOIN v_parties v ON v.party_id = r.author_party_id
    LEFT JOIN orders o ON o.id = r.order_id`;

function toReview(r: Record<string, unknown>): ReviewRow {
  return {
    id: Number(r.id),
    authorPartyId: Number(r.author_party_id),
    authorName: String(r.author_name ?? ""),
    subjectPartyId: Number(r.subject_party_id),
    orderId: r.order_id == null ? null : Number(r.order_id),
    orderNo: String(r.order_no ?? ""),
    commodity: String(r.commodity ?? ""),
    qty: Number(r.qty ?? 0),
    unit: String(r.unit ?? ""),
    quality: Number(r.quality ?? 0),
    delivery: Number(r.delivery ?? 0),
    communication: Number(r.communication ?? 0),
    note: String(r.note ?? ""),
    createdAt: String(r.created_at ?? ""),
  };
}

/** Reviews written about one party — what its counterparties actually said. */
export async function listReviewsAbout(partyId: number): Promise<ReviewRow[]> {
  return withDb("listReviewsAbout", async (db) => {
    const rows = (await db.execute(
      `${REVIEW_SELECT} WHERE r.subject_party_id = ? ORDER BY r.created_at DESC, r.id DESC;`,
      [partyId])).rows ?? [];
    return rows.map(toReview);
  });
}

/** Reviews the caller has written. */
export async function listMyReviews(ctx: SessionContext | null): Promise<ReviewRow[]> {
  if (ctx == null) return [];
  return withDb("listMyReviews", async (db) => {
    const rows = (await db.execute(
      `${REVIEW_SELECT} WHERE r.author_party_id = ? ORDER BY r.created_at DESC, r.id DESC;`,
      [ctx.partyId])).rows ?? [];
    return rows.map(toReview);
  });
}

/**
 * A party's rating, computed from its reviews.
 *
 * Returns zeroes rather than null for an unrated party so callers can render a
 * figure without branching; `reviewCount === 0` is how "not yet rated" is told
 * apart from "rated zero", which the 1–5 CHECK makes impossible anyway.
 */
export async function getReputation(partyId: number): Promise<Reputation> {
  return withDb("getReputation", async (db) => {
    const rows = (await db.execute(
      "SELECT rating, review_count FROM v_party_reputation WHERE party_id = ?;",
      [partyId])).rows ?? [];
    if (rows.length === 0) return { rating: 0, reviewCount: 0 };
    return { rating: Number(rows[0].rating ?? 0), reviewCount: Number(rows[0].review_count ?? 0) };
  });
}

/** Ratings for many parties at once, for the matching lists. */
export async function reputationByParty(): Promise<Map<number, Reputation>> {
  return withDb("reputationByParty", async (db) => {
    const rows = (await db.execute("SELECT * FROM v_party_reputation;")).rows ?? [];
    const map = new Map<number, Reputation>();
    for (const r of rows) {
      map.set(Number(r.party_id), {
        rating: Number(r.rating ?? 0),
        reviewCount: Number(r.review_count ?? 0),
      });
    }
    return map;
  });
}

export interface NewReviewInput {
  orderId: number;
  quality: number;
  delivery: number;
  communication: number;
  note?: string | null;
}

/**
 * Records a review against an order.
 *
 * The subject is derived from the order — whichever side the author is not — so
 * there is no way to rate a party who was not on the other end of this trade.
 */
export async function submit(ctx: SessionContext | null, input: NewReviewInput): Promise<void> {
  if (ctx == null) throw new AuthzError("Sign in to leave a review.");

  await withWrite("submitReview", async (db) => {
    const rows = (await db.execute(
      "SELECT seller_party_id, buyer_party_id, status FROM orders WHERE id = ?;",
      [input.orderId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That order no longer exists.");

    const seller = Number(rows[0].seller_party_id);
    const buyer = Number(rows[0].buyer_party_id);
    if (ctx.partyId !== seller && ctx.partyId !== buyer) {
      throw new AuthzError("You can only review an order you were part of.");
    }

    const status = String(rows[0].status);
    if (status !== "delivered" && status !== "paid") {
      throw new AuthzError("You can review an order once it has been delivered.");
    }

    const subject = ctx.partyId === seller ? buyer : seller;

    const already = (await db.execute(
      "SELECT 1 AS ok FROM reviews_v2 WHERE author_party_id = ? AND order_id = ?;",
      [ctx.partyId, input.orderId])).rows ?? [];
    if (already.length > 0) throw new AuthzError("You have already reviewed this order.");

    await db.execute(
      `INSERT INTO reviews_v2
         (author_party_id, subject_party_id, order_id, quality, delivery, communication, note)
       VALUES (?,?,?,?,?,?,?);`,
      [ctx.partyId, subject, input.orderId, input.quality, input.delivery,
        input.communication, input.note ?? null]);

    await notifyParty(db, {
      recipient: subject,
      actor: ctx.partyId,
      type: "review_received",
      title: "You received a review",
      body: input.note ?? null,
      orderId: input.orderId,
    });
  });
}
