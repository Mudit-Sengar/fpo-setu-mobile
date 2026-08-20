import { withDb, withWrite } from "../connection";
import { AuthzError, type SessionContext } from "../authz";
import { notifyParty, partyIdFor } from "./networkRepository";
import { record } from "./auditRepository";

/**
 * Orders — the row a trade actually is.
 *
 * An order is created when a request author accepts a reply, so it inherits both
 * sides from rows that already exist rather than from anything a screen passes.
 * Advancing it to `paid` is what posts the FPO's ledger line and the farmer's
 * transaction, which is why those three views of one trade can no longer drift.
 */

export type OrderStatus =
  | "draft" | "confirmed" | "in_transit" | "delivered" | "paid" | "cancelled" | "disputed";

export interface OrderRow {
  id: number;
  orderNo: string;
  sellerPartyId: number;
  buyerPartyId: number;
  sellerName: string;
  buyerName: string;
  /** The other side, from the caller's point of view. */
  counterpartyName: string;
  iAmSeller: boolean;
  commodity: string;
  grade: string;
  qty: number;
  unit: string;
  pricePerUnit: number;
  totalAmount: number;
  status: OrderStatus;
  deliveredAt: string;
  paidAt: string;
  createdAt: string;
  /** Whether the caller has already reviewed this order. */
  reviewed: boolean;
}

/** Statuses an order may move to from where it is. */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["in_transit", "delivered", "cancelled"],
  in_transit: ["delivered", "disputed"],
  delivered: ["paid", "disputed"],
  paid: [],
  cancelled: [],
  disputed: ["delivered", "cancelled"],
};

const ORDER_SELECT = `
  WITH me(id) AS (SELECT ?)
  SELECT o.*, s.name AS seller_name, b.name AS buyer_name,
         (SELECT COUNT(*) FROM reviews_v2 r
           WHERE r.order_id = o.id AND r.author_party_id = me.id) AS reviewed
    FROM orders o
    CROSS JOIN me
    JOIN v_parties s ON s.party_id = o.seller_party_id
    JOIN v_parties b ON b.party_id = o.buyer_party_id`;

function toOrder(r: Record<string, unknown>, me: number): OrderRow {
  const iAmSeller = Number(r.seller_party_id) === me;
  return {
    id: Number(r.id),
    orderNo: String(r.order_no ?? ""),
    sellerPartyId: Number(r.seller_party_id),
    buyerPartyId: Number(r.buyer_party_id),
    sellerName: String(r.seller_name ?? ""),
    buyerName: String(r.buyer_name ?? ""),
    counterpartyName: iAmSeller ? String(r.buyer_name ?? "") : String(r.seller_name ?? ""),
    iAmSeller,
    commodity: String(r.commodity ?? ""),
    grade: String(r.grade ?? ""),
    qty: Number(r.qty ?? 0),
    unit: String(r.unit ?? "MT"),
    pricePerUnit: Number(r.price_per_unit ?? 0),
    totalAmount: Number(r.total_amount ?? 0),
    status: String(r.status) as OrderStatus,
    deliveredAt: String(r.delivered_at ?? ""),
    paidAt: String(r.paid_at ?? ""),
    createdAt: String(r.created_at ?? ""),
    reviewed: Number(r.reviewed ?? 0) > 0,
  };
}

/** Every order this session is a party to, either side. */
export async function listMyOrders(ctx: SessionContext | null): Promise<OrderRow[]> {
  if (ctx == null) return [];
  return withDb("listMyOrders", async (db) => {
    const rows = (await db.execute(
      `${ORDER_SELECT} WHERE o.seller_party_id = ? OR o.buyer_party_id = ?
        ORDER BY o.created_at DESC, o.id DESC;`,
      [ctx.partyId, ctx.partyId, ctx.partyId])).rows ?? [];
    return rows.map((r) => toOrder(r, ctx.partyId));
  });
}

/** Delivered or paid orders the caller can still review. */
export async function listReviewableOrders(ctx: SessionContext | null): Promise<OrderRow[]> {
  if (ctx == null) return [];
  return withDb("listReviewableOrders", async (db) => {
    const rows = (await db.execute(
      `${ORDER_SELECT}
        WHERE (o.seller_party_id = ? OR o.buyer_party_id = ?)
          AND o.status IN ('delivered','paid')
        ORDER BY o.created_at DESC, o.id DESC;`,
      [ctx.partyId, ctx.partyId, ctx.partyId])).rows ?? [];
    return rows.map((r) => toOrder(r, ctx.partyId)).filter((o) => !o.reviewed);
  });
}

/* --------------------------------------------------------------- writing -- */

interface DbLike {
  execute: (sql: string, params?: (string | number | boolean | null)[])
    => Promise<{ rows?: Record<string, unknown>[] }>;
}

/**
 * Creates the order behind an accepted reply.
 *
 * Which side sells is decided by the request kind, not by anything passed in: on
 * a `*_supply` posting the author is offering goods, on a `*_demand` posting the
 * author wants them. Called from requestRepository inside the same transaction as
 * the acceptance, so a reply can never be accepted without its order.
 */
export async function createFromAcceptedResponse(
  db: DbLike, responseId: number, actorUserId: number,
): Promise<number | null> {
  const rows = (await db.execute(
    `SELECT resp.id, resp.responder_party_id, resp.offered_qty, resp.offered_price, resp.offered_unit,
            r.id AS request_id, r.author_party_id, r.kind, r.item, r.grade, r.qty, r.unit,
            r.price_expectation, r.window_label
       FROM request_responses resp
       JOIN requests r ON r.id = resp.request_id
      WHERE resp.id = ?;`, [responseId])).rows ?? [];
  if (rows.length === 0) return null;
  const r = rows[0];

  const kind = String(r.kind);
  const authorSells = kind === "commodity_supply" || kind === "input_supply";
  const author = Number(r.author_party_id);
  const responder = Number(r.responder_party_id);
  const sellerPartyId = authorSells ? author : responder;
  const buyerPartyId = authorSells ? responder : author;
  if (sellerPartyId === buyerPartyId) return null;

  const qty = Number(r.offered_qty ?? r.qty ?? 0);
  if (qty <= 0) return null;
  const price = Number(r.offered_price ?? r.price_expectation ?? 0);

  await db.execute(
    `INSERT OR IGNORE INTO orders
       (seller_party_id, buyer_party_id, origin_request_id, origin_response_id,
        commodity, grade, qty, unit, price_per_unit, total_amount, status, delivery_due)
     VALUES (?,?,?,?,?,?,?,?,?,?, 'confirmed', ?);`,
    [sellerPartyId, buyerPartyId, Number(r.request_id), responseId,
      String(r.item), String(r.grade ?? ""), qty,
      String(r.offered_unit ?? r.unit ?? "MT"), price, qty * price,
      String(r.window_label ?? "") || null]);

  const created = (await db.execute(
    "SELECT id FROM orders WHERE origin_response_id = ?;", [responseId])).rows ?? [];
  if (created.length === 0) return null;
  const orderId = Number(created[0].id);
  await db.execute(
    "UPDATE orders SET order_no = 'ORD-' || printf('%06d', id) WHERE id = ? AND order_no IS NULL;",
    [orderId]);

  await notifyParty(db, {
    recipient: sellerPartyId === author ? buyerPartyId : sellerPartyId,
    actor: author,
    type: "order_created",
    title: "Order confirmed",
    body: `${qty} ${String(r.unit ?? "MT")} ${String(r.item)}`,
    orderId,
  });
  void actorUserId;
  return orderId;
}

/**
 * Moves an order along.
 *
 * Either party may advance it — a seller marks delivery, a buyer confirms payment
 * — but only through a transition the current status allows, so an order cannot
 * jump from confirmed straight to paid without a delivery having been recorded.
 *
 * Reaching `paid` is what posts the accounting: a ledger line for whichever side
 * is an FPO, and a transaction row for a farmer seller. That is the whole point
 * of the order existing.
 */
export async function advance(
  ctx: SessionContext | null, orderId: number, to: OrderStatus,
): Promise<void> {
  if (ctx == null) throw new AuthzError("You are signed out.");

  await withWrite("advanceOrder", async (db) => {
    const rows = (await db.execute("SELECT * FROM orders WHERE id = ?;", [orderId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That order no longer exists.");
    const o = rows[0];

    const seller = Number(o.seller_party_id);
    const buyer = Number(o.buyer_party_id);
    if (ctx.partyId !== seller && ctx.partyId !== buyer) {
      throw new AuthzError("You are not part of this order.");
    }

    const from = String(o.status) as OrderStatus;
    if (!NEXT[from].includes(to)) {
      throw new AuthzError(`An order that is ${from} cannot move to ${to}.`);
    }

    await db.execute(
      `UPDATE orders
          SET status = ?, updated_at = datetime('now'),
              delivered_at = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE delivered_at END,
              paid_at      = CASE WHEN ? = 'paid'      THEN datetime('now') ELSE paid_at END
        WHERE id = ?;`,
      [to, to, to, orderId]);

    if (to === "paid") {
      await postAccounting(db, orderId, o);
    }

    await notifyParty(db, {
      recipient: ctx.partyId === seller ? buyer : seller,
      actor: ctx.partyId,
      type: `order_${to}`,
      title: to === "paid" ? "Order paid" : to === "delivered" ? "Order delivered" : "Order updated",
      body: String(o.commodity ?? ""),
      orderId,
    });
    await record(db, ctx, {
      action: "order_advanced", entityType: "order", entityId: orderId,
      fromStatus: from, toStatus: to, detail: String(o.order_no ?? ""),
    });
  });
}

/**
 * Writes the bookkeeping a paid order implies.
 *
 * An FPO on either side gets a ledger line — income when it sold, expense when it
 * bought — carrying the running balance the screen already displays. A farmer
 * seller gets the transaction row that shows in their history. Both point at the
 * order, so the numbers come from one place.
 */
async function postAccounting(db: DbLike, orderId: number, o: Record<string, unknown>): Promise<void> {
  const seller = Number(o.seller_party_id);
  const buyer = Number(o.buyer_party_id);
  const amount = Number(o.total_amount ?? 0);
  const commodity = String(o.commodity ?? "");

  const sides = (await db.execute(
    `SELECT party_id, kind, entity_id FROM v_parties WHERE party_id IN (?, ?);`,
    [seller, buyer])).rows ?? [];

  for (const side of sides) {
    const partyId = Number(side.party_id);
    const kind = String(side.kind);
    const entityId = String(side.entity_id);
    const isSeller = partyId === seller;
    const other = isSeller ? buyer : seller;

    if (kind === "fpo") {
      const already = (await db.execute(
        "SELECT 1 AS ok FROM ledger_entries WHERE order_id = ? AND fpo_id = ?;",
        [orderId, entityId])).rows ?? [];
      if (already.length > 0) continue;

      const last = (await db.execute(
        "SELECT balance FROM ledger_entries WHERE fpo_id = ? ORDER BY id DESC LIMIT 1;",
        [entityId])).rows ?? [];
      const running = Number(last[0]?.balance ?? 0);
      const type = isSeller ? "Income" : "Expense";
      const balance = isSeller ? running + amount : running - amount;

      await db.execute(
        `INSERT INTO ledger_entries
           (fpo_id, date, description, type, amount, balance, counterparty_party_id, order_id)
         VALUES (?, date('now'), ?, ?, ?, ?, ?, ?);`,
        [entityId, `${commodity} ${isSeller ? "sale" : "procurement"}`,
          type, amount, balance, other, orderId]);
    }

    if (kind === "farmer" && isSeller) {
      const already = (await db.execute(
        "SELECT 1 AS ok FROM farmer_txns WHERE order_id = ?;", [orderId])).rows ?? [];
      if (already.length > 0) continue;

      const membership = (await db.execute(
        "SELECT id FROM memberships WHERE farmer_id = ? AND status = 'active' LIMIT 1;",
        [entityId])).rows ?? [];

      await db.execute(
        `INSERT INTO farmer_txns
           (farmer_id, date, crop, qty_q, price, amount, order_id, membership_id)
         VALUES (?, date('now'), ?, ?, ?, ?, ?, ?);`,
        [entityId, commodity, Number(o.qty ?? 0), Number(o.price_per_unit ?? 0),
          amount, orderId, membership.length > 0 ? Number(membership[0].id) : null]);
    }
  }
}

/** Party ids the caller has traded with, for the ledger's counterparty picker. */
export async function listTradedParties(
  ctx: SessionContext | null,
): Promise<{ partyId: number; name: string; kind: string }[]> {
  if (ctx == null) return [];
  return withDb("listTradedParties", async (db) => {
    const rows = (await db.execute(
      `SELECT DISTINCT v.party_id, v.name, v.kind
         FROM v_parties v
        WHERE v.party_id IN (
                SELECT CASE WHEN o.seller_party_id = ? THEN o.buyer_party_id ELSE o.seller_party_id END
                  FROM orders o WHERE o.seller_party_id = ? OR o.buyer_party_id = ?
                UNION
                SELECT CASE WHEN c.requester_party_id = ? THEN c.addressee_party_id ELSE c.requester_party_id END
                  FROM connections c
                 WHERE (c.requester_party_id = ? OR c.addressee_party_id = ?) AND c.status = 'accepted'
                UNION
                SELECT p.id FROM memberships m
                  JOIN parties p ON p.kind = 'farmer' AND p.entity_id = m.farmer_id
                 WHERE m.fpo_id = ? AND m.status = 'active')
        ORDER BY v.kind, v.name;`,
      [ctx.partyId, ctx.partyId, ctx.partyId, ctx.partyId, ctx.partyId, ctx.partyId, ctx.profileId])).rows ?? [];
    return rows.map((r) => ({
      partyId: Number(r.party_id),
      name: String(r.name),
      kind: String(r.kind),
    }));
  });
}

/** Resolves the party id for an entity, re-exported so screens need one import. */
export { partyIdFor };
