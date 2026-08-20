import { withDb, withWrite } from "../connection";
import { AuthzError, type SessionContext } from "../authz";
import { notifyParty, partyIdFor } from "./networkRepository";
import { record } from "./auditRepository";

/**
 * Requests for credit, compliance work, contract templates and advice.
 *
 * These were the last three simulated actions in the app: "Apply" on a lender,
 * "Request service" on a compliance partner, and "Download Sample Contract" all
 * showed a success toast and wrote nothing. The providers on the other side were
 * rows in five ID-less directories with no way to receive anything, which is why
 * migration 003 folded them into `service_providers` and gave them a party.
 */

export type ServiceType = "credit" | "compliance" | "logistics" | "advisory" | "contract";
export type ServiceStatus =
  | "pending" | "in_review" | "approved" | "rejected" | "completed" | "withdrawn";

export interface ServiceRequestRow {
  id: number;
  requesterPartyId: number;
  requesterName: string;
  providerPartyId: number;
  providerName: string;
  providerType: string;
  serviceType: ServiceType;
  subject: string;
  details: string;
  amountRequested: number | null;
  status: ServiceStatus;
  createdAt: string;
  decidedAt: string;
  /** True when the caller sent it, so the UI knows which side it is on. */
  outgoing: boolean;
}

/** Where each status may go next. A decided request cannot be re-decided. */
const NEXT: Record<ServiceStatus, ServiceStatus[]> = {
  pending: ["in_review", "approved", "rejected", "withdrawn"],
  in_review: ["approved", "rejected"],
  approved: ["completed"],
  rejected: [],
  completed: [],
  withdrawn: [],
};

const SELECT = `
  WITH me(id) AS (SELECT ?)
  SELECT sr.*, req.name AS requester_name, prov.name AS provider_name,
         sp.provider_type
    FROM service_requests sr
    CROSS JOIN me
    JOIN v_parties req  ON req.party_id  = sr.requester_party_id
    JOIN v_parties prov ON prov.party_id = sr.provider_party_id
    LEFT JOIN service_providers sp ON sp.id = prov.entity_id`;

function toRow(r: Record<string, unknown>, me: number): ServiceRequestRow {
  return {
    id: Number(r.id),
    requesterPartyId: Number(r.requester_party_id),
    requesterName: String(r.requester_name ?? ""),
    providerPartyId: Number(r.provider_party_id),
    providerName: String(r.provider_name ?? ""),
    providerType: String(r.provider_type ?? ""),
    serviceType: String(r.service_type) as ServiceType,
    subject: String(r.subject ?? ""),
    details: String(r.details ?? ""),
    amountRequested: r.amount_requested == null ? null : Number(r.amount_requested),
    status: String(r.status) as ServiceStatus,
    createdAt: String(r.created_at ?? ""),
    decidedAt: String(r.decided_at ?? ""),
    outgoing: Number(r.requester_party_id) === me,
  };
}

/** Requests this session has sent — the application tracker. */
export async function listMyRequests(ctx: SessionContext | null): Promise<ServiceRequestRow[]> {
  if (ctx == null) return [];
  return withDb("listMyServiceRequests", async (db) => {
    const rows = (await db.execute(
      `${SELECT} WHERE sr.requester_party_id = ? ORDER BY sr.created_at DESC, sr.id DESC;`,
      [ctx.partyId, ctx.partyId])).rows ?? [];
    return rows.map((r) => toRow(r, ctx.partyId));
  });
}

/** Requests addressed to this session — the provider's queue. */
export async function listInbox(ctx: SessionContext | null): Promise<ServiceRequestRow[]> {
  if (ctx == null) return [];
  return withDb("listServiceInbox", async (db) => {
    const rows = (await db.execute(
      `${SELECT} WHERE sr.provider_party_id = ? ORDER BY sr.created_at DESC, sr.id DESC;`,
      [ctx.partyId, ctx.partyId])).rows ?? [];
    return rows.map((r) => toRow(r, ctx.partyId));
  });
}

/** Service providers of one kind, for the directory screens. */
export async function listProviders(
  providerType: string,
): Promise<{ partyId: number; id: string; name: string; note: string; feeNote: string }[]> {
  return withDb("listProviders", async (db) => {
    const rows = (await db.execute(
      `SELECT sp.id, sp.name, sp.product_note, sp.eligibility_note, sp.fee_note,
              sp.specialisation, p.id AS party_id
         FROM service_providers sp
         JOIN parties p ON p.kind = 'service_provider' AND p.entity_id = sp.id AND p.is_active = 1
        WHERE sp.provider_type = ? AND sp.is_active = 1
        ORDER BY sp.name;`, [providerType])).rows ?? [];
    return rows.map((r) => ({
      partyId: Number(r.party_id),
      id: String(r.id),
      name: String(r.name),
      note: String(r.product_note ?? r.specialisation ?? ""),
      feeNote: String(r.fee_note ?? r.eligibility_note ?? ""),
    }));
  });
}

export interface NewServiceRequest {
  providerPartyId: number;
  serviceType: ServiceType;
  subject: string;
  details?: string | null;
  amountRequested?: number | null;
}

/**
 * Sends a request to a provider.
 *
 * Reusing an open request rather than stacking duplicates: tapping "Apply" twice
 * on the same lender means "I still want this", not "consider me twice".
 */
export async function request(
  ctx: SessionContext | null, input: NewServiceRequest,
): Promise<number> {
  if (ctx == null) throw new AuthzError("Sign in to make a request.");
  if (input.providerPartyId === ctx.partyId) {
    throw new AuthzError("You cannot send a request to yourself.");
  }

  return withWrite("requestService", async (db) => {
    const provider = (await db.execute(
      "SELECT id FROM parties WHERE id = ? AND is_active = 1;", [input.providerPartyId])).rows ?? [];
    if (provider.length === 0) throw new AuthzError("That provider is not available.");

    const open = (await db.execute(
      `SELECT id FROM service_requests
        WHERE requester_party_id = ? AND provider_party_id = ? AND service_type = ?
          AND status IN ('pending','in_review');`,
      [ctx.partyId, input.providerPartyId, input.serviceType])).rows ?? [];

    if (open.length > 0) {
      const id = Number(open[0].id);
      await db.execute(
        `UPDATE service_requests SET subject = ?, details = ?, amount_requested = ?,
            created_at = datetime('now') WHERE id = ?;`,
        [input.subject, input.details ?? null, input.amountRequested ?? null, id]);
      return id;
    }

    await db.execute(
      `INSERT INTO service_requests
         (requester_party_id, provider_party_id, service_type, subject, details, amount_requested)
       VALUES (?,?,?,?,?,?);`,
      [ctx.partyId, input.providerPartyId, input.serviceType, input.subject,
        input.details ?? null, input.amountRequested ?? null]);

    const created = (await db.execute(
      `SELECT id FROM service_requests WHERE requester_party_id = ? AND provider_party_id = ?
        ORDER BY id DESC LIMIT 1;`, [ctx.partyId, input.providerPartyId])).rows ?? [];
    const id = Number(created[0].id);

    await notifyParty(db, {
      recipient: input.providerPartyId,
      actor: ctx.partyId,
      type: "service_request",
      title: `New ${input.serviceType} request`,
      body: input.subject,
    });
    await record(db, ctx, {
      action: "service_requested", entityType: "service_request", entityId: id,
      toStatus: "pending", detail: input.subject,
    });
    return id;
  });
}

/**
 * Advances a request.
 *
 * The provider decides; the requester may only withdraw. Both go through the same
 * transition table so neither can skip a step or revisit a settled one.
 */
export async function advance(
  ctx: SessionContext | null, requestId: number, to: ServiceStatus,
): Promise<void> {
  if (ctx == null) throw new AuthzError("You are signed out.");

  await withWrite("advanceServiceRequest", async (db) => {
    const rows = (await db.execute(
      "SELECT requester_party_id, provider_party_id, status, subject FROM service_requests WHERE id = ?;",
      [requestId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That request no longer exists.");

    const requester = Number(rows[0].requester_party_id);
    const provider = Number(rows[0].provider_party_id);
    const from = String(rows[0].status) as ServiceStatus;

    const isProvider = ctx.partyId === provider;
    const isRequester = ctx.partyId === requester;
    if (!isProvider && !isRequester) {
      throw new AuthzError("You are not part of this request.");
    }
    if (to === "withdrawn" && !isRequester) {
      throw new AuthzError("Only the party who applied can withdraw.");
    }
    if (to !== "withdrawn" && !isProvider) {
      throw new AuthzError("Only the provider can decide this request.");
    }
    if (!NEXT[from].includes(to)) {
      throw new AuthzError(`A request that is ${from.replace("_", " ")} cannot move to ${to}.`);
    }

    await db.execute(
      `UPDATE service_requests
          SET status = ?, decided_at = datetime('now'), decided_by_user_id = ?
        WHERE id = ?;`, [to, ctx.userId, requestId]);

    await notifyParty(db, {
      recipient: isProvider ? requester : provider,
      actor: ctx.partyId,
      type: `service_${to}`,
      title: to === "approved" ? "Your request was approved"
        : to === "rejected" ? "Your request was declined"
          : to === "completed" ? "Your request is complete"
            : "Request updated",
      body: String(rows[0].subject ?? ""),
    });
    await record(db, ctx, {
      action: "service_decided", entityType: "service_request", entityId: requestId,
      fromStatus: from, toStatus: to,
    });
  });
}

/** Resolves a provider's party by its legacy directory name. */
export async function providerPartyByName(
  providerType: string, name: string,
): Promise<number | null> {
  return partyIdFor("service_provider", await withDb("providerIdByName", async (db) => {
    const rows = (await db.execute(
      "SELECT id FROM service_providers WHERE provider_type = ? AND name = ? LIMIT 1;",
      [providerType, name])).rows ?? [];
    return rows.length === 0 ? "" : String(rows[0].id);
  }));
}
