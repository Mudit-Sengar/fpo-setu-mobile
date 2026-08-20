import { withDb, withWrite } from "../connection";
import { AuthzError, requireAnyProfile, type SessionContext } from "../authz";
import type { ViewRole } from "./authRepository";
import { notifyParty } from "./networkRepository";
import { createFromAcceptedResponse } from "./orderRepository";
import { record } from "./auditRepository";

/**
 * Requests and the responses to them — the first data in this app that one
 * persona creates and another persona acts on.
 *
 * Two rules are enforced here rather than in the screens, because a screen is a
 * suggestion and a repository is the last place a write can be stopped:
 *
 *  - the author of a request is the session, never a parameter;
 *  - only a request's author may accept or reject a response to it.
 */

export type RequestKind = "commodity_supply" | "commodity_demand" | "input_supply" | "input_demand";
export type RequestStatus = "draft" | "open" | "matched" | "fulfilled" | "expired" | "cancelled";
export type ResponseStatus = "pending" | "accepted" | "rejected" | "withdrawn" | "expired";

/**
 * Which roles may author which kind of request.
 *
 * More than one persona legitimately posts most of these. An FPO aggregates and
 * sells, but so does a farmer large enough to deal direct. A buyer wants to buy
 * produce — and so does an FPO, from its own members, which is what most of its
 * ledger consists of. Restricting each kind to a single role left FPO procurement
 * with no way to be expressed at all.
 */
const AUTHOR_ROLES: Record<RequestKind, ViewRole[]> = {
  commodity_supply: ["fpo", "farmer"],
  commodity_demand: ["buyer", "fpo"],
  input_supply: ["supplier"],
  input_demand: ["fpo", "farmer"],
};

export interface RequestRow {
  id: number;
  authorPartyId: number;
  authorKind: string;
  authorEntityId: string;
  authorName: string;
  kind: RequestKind;
  item: string;
  category: string;
  grade: string;
  qty: number;
  qtyLabel: string;
  unit: string;
  windowLabel: string;
  district: string;
  status: RequestStatus;
  createdAt: string;
  /** Responses received, and how many are still awaiting a decision. */
  responseCount: number;
  pendingCount: number;
}

export interface ResponseRow {
  id: number;
  requestId: number;
  responderPartyId: number;
  responderKind: string;
  responderEntityId: string;
  responderName: string;
  message: string;
  offeredQty: number | null;
  offeredPrice: number | null;
  status: ResponseStatus;
  respondedAt: string;
  /** Enough of the request to render an inbox row without a second query. */
  requestKind: RequestKind;
  requestItem: string;
  requestQtyLabel: string;
}

/* --------------------------------------------------------------- reading -- */

// Response counts are aggregated in the query rather than by a second round trip,
// because the FPO's own-requests list renders one badge per row.
const REQUEST_SELECT = `
  SELECT r.*, v.name AS author_name, v.kind AS author_kind, v.entity_id AS author_entity_id,
         (SELECT COUNT(*) FROM request_responses x WHERE x.request_id = r.id) AS response_count,
         (SELECT COUNT(*) FROM request_responses x WHERE x.request_id = r.id AND x.status = 'pending') AS pending_count
    FROM requests r
    JOIN v_parties v ON v.party_id = r.author_party_id`;

function toRequest(r: Record<string, unknown>): RequestRow {
  return {
    id: Number(r.id),
    authorPartyId: Number(r.author_party_id),
    authorKind: String(r.author_kind ?? ""),
    authorEntityId: String(r.author_entity_id ?? ""),
    authorName: String(r.author_name ?? ""),
    kind: String(r.kind) as RequestKind,
    item: String(r.item),
    category: String(r.category ?? ""),
    grade: String(r.grade ?? ""),
    qty: Number(r.qty ?? 0),
    qtyLabel: String(r.qty_label ?? ""),
    unit: String(r.unit ?? "MT"),
    windowLabel: String(r.window_label ?? ""),
    district: String(r.district ?? ""),
    status: String(r.status) as RequestStatus,
    createdAt: String(r.created_at ?? ""),
    responseCount: Number(r.response_count ?? 0),
    pendingCount: Number(r.pending_count ?? 0),
  };
}

/** Every request this session has authored, newest first. */
export async function listMyRequests(
  ctx: SessionContext | null, kind?: RequestKind,
): Promise<RequestRow[]> {
  if (ctx == null) return [];
  return withDb("listMyRequests", async (db) => {
    const sql = `${REQUEST_SELECT} WHERE r.author_party_id = ?${kind == null ? "" : " AND r.kind = ?"}
                 ORDER BY r.created_at DESC, r.id DESC;`;
    const params: (string | number)[] = kind == null ? [ctx.partyId] : [ctx.partyId, kind];
    return ((await db.execute(sql, params)).rows ?? []).map(toRequest);
  });
}

export interface OpenRequestFilter {
  kind: RequestKind;
  /** Case-insensitive exact match on the commodity or input item. */
  item?: string;
  category?: string;
  /** Hides the caller's own requests — nobody matches against themselves. */
  excludePartyId?: number;
}

/** Open requests from other parties, for the matching screens. */
export async function listOpenRequests(filter: OpenRequestFilter): Promise<RequestRow[]> {
  return withDb("listOpenRequests", async (db) => {
    const where: string[] = ["r.status = 'open'", "r.kind = ?"];
    const params: (string | number)[] = [filter.kind];

    if (filter.item != null && filter.item !== "") {
      where.push("LOWER(r.item) = LOWER(?)");
      params.push(filter.item);
    }
    if (filter.category != null && filter.category !== "") {
      where.push("r.category = ?");
      params.push(filter.category);
    }
    if (filter.excludePartyId != null) {
      where.push("r.author_party_id <> ?");
      params.push(filter.excludePartyId);
    }

    const sql = `${REQUEST_SELECT} WHERE ${where.join(" AND ")} ORDER BY r.qty DESC, r.id DESC;`;
    return ((await db.execute(sql, params)).rows ?? []).map(toRequest);
  });
}

const RESPONSE_SELECT = `
  SELECT resp.*, v.name AS responder_name, v.kind AS responder_kind, v.entity_id AS responder_entity_id,
         r.kind AS request_kind, r.item AS request_item, r.qty AS request_qty,
         r.qty_label AS request_qty_label, r.unit AS request_unit
    FROM request_responses resp
    JOIN requests r ON r.id = resp.request_id
    JOIN v_parties v ON v.party_id = resp.responder_party_id`;

function toResponse(r: Record<string, unknown>): ResponseRow {
  const label = String(r.request_qty_label ?? "");
  return {
    id: Number(r.id),
    requestId: Number(r.request_id),
    responderPartyId: Number(r.responder_party_id),
    responderKind: String(r.responder_kind ?? ""),
    responderEntityId: String(r.responder_entity_id ?? ""),
    responderName: String(r.responder_name ?? ""),
    message: String(r.message ?? ""),
    offeredQty: r.offered_qty == null ? null : Number(r.offered_qty),
    offeredPrice: r.offered_price == null ? null : Number(r.offered_price),
    status: String(r.status) as ResponseStatus,
    respondedAt: String(r.responded_at ?? ""),
    requestKind: String(r.request_kind) as RequestKind,
    requestItem: String(r.request_item ?? ""),
    requestQtyLabel: label !== "" ? label : `${Number(r.request_qty ?? 0)} ${String(r.request_unit ?? "MT")}`,
  };
}

/** Responses other parties have sent to this session's requests. */
export async function listInboxResponses(
  ctx: SessionContext | null, onlyPending = false,
): Promise<ResponseRow[]> {
  if (ctx == null) return [];
  return withDb("listInboxResponses", async (db) => {
    const sql = `${RESPONSE_SELECT} WHERE r.author_party_id = ?
                 ${onlyPending ? "AND resp.status = 'pending'" : ""}
                 ORDER BY resp.responded_at DESC, resp.id DESC;`;
    return ((await db.execute(sql, [ctx.partyId])).rows ?? []).map(toResponse);
  });
}

/** Responses to one request. Readable by that request's author only. */
export async function listResponsesFor(
  ctx: SessionContext | null, requestId: number,
): Promise<ResponseRow[]> {
  if (ctx == null) return [];
  return withDb("listResponsesFor", async (db) => {
    const sql = `${RESPONSE_SELECT} WHERE resp.request_id = ? AND r.author_party_id = ?
                 ORDER BY resp.responded_at DESC;`;
    return ((await db.execute(sql, [requestId, ctx.partyId])).rows ?? []).map(toResponse);
  });
}

/** Responses this session has sent, so a responder can see won/lost. */
export async function listMyResponses(ctx: SessionContext | null): Promise<ResponseRow[]> {
  if (ctx == null) return [];
  return withDb("listMyResponses", async (db) => {
    const sql = `${RESPONSE_SELECT} WHERE resp.responder_party_id = ?
                 ORDER BY resp.responded_at DESC, resp.id DESC;`;
    return ((await db.execute(sql, [ctx.partyId])).rows ?? []).map(toResponse);
  });
}

/* --------------------------------------------------------------- writing -- */

export interface NewRequestInput {
  kind: RequestKind;
  item: string;
  category?: string | null;
  grade?: string | null;
  qty: number;
  qtyLabel?: string | null;
  unit?: string;
  windowLabel?: string | null;
  district?: string | null;
  priceExpectation?: number | null;
  priceUnit?: string | null;
}

/**
 * Posts a request authored by this session.
 *
 * The role that may author each kind is fixed (only a buyer posts a demand, only
 * a supplier posts an input supply), so `requireProfile` is called with the role
 * the kind implies. A buyer session cannot post an FPO's supply even by passing
 * the kind directly.
 */
export async function createRequest(
  ctx: SessionContext | null, input: NewRequestInput,
): Promise<number> {
  requireAnyProfile(ctx, AUTHOR_ROLES[input.kind]);
  const authorPartyId = ctx!.partyId;

  return withWrite("createRequest", async (db) => {
    await db.execute(
      `INSERT INTO requests
         (author_party_id, kind, item, category, grade, qty, qty_label, unit,
          window_label, district, price_expectation, price_unit, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'open');`,
      [authorPartyId, input.kind, input.item, input.category ?? null, input.grade ?? null,
        input.qty, input.qtyLabel ?? null, input.unit ?? "MT", input.windowLabel ?? null,
        input.district ?? null, input.priceExpectation ?? null, input.priceUnit ?? null],
    );
    const rows = (await db.execute(
      "SELECT id FROM requests WHERE author_party_id = ? ORDER BY id DESC LIMIT 1;",
      [authorPartyId])).rows ?? [];
    return Number(rows[0]?.id ?? 0);
  });
}

/** Withdraws one of this session's own requests. */
export async function cancelRequest(ctx: SessionContext | null, requestId: number): Promise<void> {
  if (ctx == null) throw new AuthzError("You are signed out.");
  await withWrite("cancelRequest", async (db) => {
    const owned = (await db.execute(
      "SELECT 1 AS ok FROM requests WHERE id = ? AND author_party_id = ?;",
      [requestId, ctx.partyId])).rows ?? [];
    if (owned.length === 0) {
      throw new AuthzError("You can only withdraw your own requests.");
    }
    await db.execute(
      "UPDATE requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?;",
      [requestId]);
  });
}

export interface NewResponseInput {
  message?: string | null;
  offeredQty?: number | null;
  offeredPrice?: number | null;
  offeredUnit?: string | null;
}

/**
 * Replies to somebody else's open request.
 *
 * Rejects three cases the UI should already prevent but must not be trusted to:
 * responding while signed out, responding to your own request, and responding to
 * a request that is no longer open.
 */
export async function respond(
  ctx: SessionContext | null, requestId: number, input: NewResponseInput = {},
): Promise<void> {
  if (ctx == null) throw new AuthzError("Sign in to respond.");

  await withWrite("respond", async (db) => {
    const rows = (await db.execute(
      "SELECT author_party_id, status FROM requests WHERE id = ?;", [requestId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That request no longer exists.");
    if (Number(rows[0].author_party_id) === ctx.partyId) {
      throw new AuthzError("You cannot respond to your own request.");
    }
    if (String(rows[0].status) !== "open") {
      throw new AuthzError("That request is closed.");
    }

    // UNIQUE (request_id, responder_party_id) makes a second response an update
    // of the first rather than a duplicate row in the author's inbox.
    await db.execute(
      `INSERT INTO request_responses
         (request_id, responder_party_id, message, offered_qty, offered_price, offered_unit, status)
       VALUES (?,?,?,?,?,?,'pending')
       ON CONFLICT (request_id, responder_party_id) DO UPDATE SET
         message = excluded.message,
         offered_qty = excluded.offered_qty,
         offered_price = excluded.offered_price,
         offered_unit = excluded.offered_unit,
         status = 'pending',
         responded_at = datetime('now'),
         decided_at = NULL,
         decided_by_user_id = NULL;`,
      [requestId, ctx.partyId, input.message ?? null, input.offeredQty ?? null,
        input.offeredPrice ?? null, input.offeredUnit ?? null],
    );

    await notifyParty(db, {
      recipient: Number(rows[0].author_party_id),
      actor: ctx.partyId,
      type: "request_response",
      title: "New reply to your posting",
      body: input.message ?? null,
      requestId,
    });
  });
}

/**
 * Accepts or rejects a response. Only the author of the responded-to request may
 * do this — ownership is checked against the request, not the response, because
 * the response belongs to the other party.
 *
 * Accepting also moves the request to `matched`, which is what takes it out of
 * everyone else's matching results.
 */
export async function decideResponse(
  ctx: SessionContext | null, responseId: number, decision: "accepted" | "rejected",
): Promise<void> {
  if (ctx == null) throw new AuthzError("You are signed out.");

  await withWrite("decideResponse", async (db) => {
    const rows = (await db.execute(
      `SELECT resp.status AS resp_status, resp.responder_party_id, r.id AS request_id, r.author_party_id
         FROM request_responses resp
         JOIN requests r ON r.id = resp.request_id
        WHERE resp.id = ?;`, [responseId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That response no longer exists.");
    if (Number(rows[0].author_party_id) !== ctx.partyId) {
      throw new AuthzError("Only the party that posted the request can decide this.");
    }
    if (String(rows[0].resp_status) !== "pending") {
      throw new AuthzError("That response has already been decided.");
    }
    const requestId = Number(rows[0].request_id);
    const responderPartyId = Number(rows[0].responder_party_id);

    await db.transaction(async (tx) => {
      await tx.execute(
        `UPDATE request_responses
            SET status = ?, decided_at = datetime('now'), decided_by_user_id = ?
          WHERE id = ?;`,
        [decision, ctx.userId, responseId]);

      if (decision === "accepted") {
        await tx.execute(
          "UPDATE requests SET status = 'matched', updated_at = datetime('now') WHERE id = ?;",
          [requestId]);
        // Accepting IS the trade being agreed, so the order is created in the same
        // transaction. A reply that is accepted without an order would leave the
        // two sides looking at a handshake neither can act on.
        await createFromAcceptedResponse(tx, responseId, ctx.userId);
      }

      await notifyParty(tx, {
        recipient: responderPartyId,
        actor: ctx.partyId,
        type: `response_${decision}`,
        title: decision === "accepted" ? "Your reply was accepted" : "Your reply was declined",
        body: null,
        requestId,
        responseId,
      });
      await record(tx, ctx, {
        action: "response_decided", entityType: "request_response", entityId: responseId,
        fromStatus: "pending", toStatus: decision,
      });
    });
  });
}
