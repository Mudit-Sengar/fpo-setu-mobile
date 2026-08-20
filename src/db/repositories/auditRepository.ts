import { withDb } from "../connection";
import type { SessionContext } from "../authz";

/**
 * The record of who changed what.
 *
 * Written by the decisions that change somebody else's standing — approving a
 * membership, accepting a reply, deciding a connection, moving an order,
 * disabling an account — and not by every write. An audit log that records
 * everything is one nobody reads, and the question it exists to answer is "who
 * did this to me?", which only has meaning where two parties are involved.
 */

export interface AuditEvent {
  id: number;
  actorName: string;
  actorUsername: string;
  action: string;
  entityType: string;
  entityId: string;
  fromStatus: string;
  toStatus: string;
  detail: string;
  createdAt: string;
}

interface DbLike {
  execute: (sql: string, params?: (string | number | boolean | null)[])
    => Promise<{ rows?: Record<string, unknown>[] }>;
}

export interface AuditInput {
  action: string;
  entityType: string;
  entityId: string | number;
  fromStatus?: string | null;
  toStatus?: string | null;
  detail?: string | null;
}

/**
 * Records one event, inside the caller's transaction.
 *
 * Takes the db handle rather than opening its own, so the audit row and the
 * change it describes commit together — a log that can disagree with the data is
 * worse than none.
 */
export async function record(
  db: DbLike, ctx: SessionContext | null, input: AuditInput,
): Promise<void> {
  await db.execute(
    `INSERT INTO audit_events
       (actor_user_id, actor_party_id, action, entity_type, entity_id,
        from_status, to_status, detail)
     VALUES (?,?,?,?,?,?,?,?);`,
    [ctx?.userId ?? null, ctx?.partyId != null && ctx.partyId > 0 ? ctx.partyId : null,
      input.action, input.entityType, String(input.entityId),
      input.fromStatus ?? null, input.toStatus ?? null, input.detail ?? null],
  );
}

/** The activity log, newest first. */
export async function listRecent(limit = 100): Promise<AuditEvent[]> {
  return withDb("listAuditEvents", async (db) => {
    const rows = (await db.execute(
      `SELECT a.*, u.display_name, u.username
         FROM audit_events a
         LEFT JOIN users u ON u.id = a.actor_user_id
        ORDER BY a.created_at DESC, a.id DESC LIMIT ?;`, [limit])).rows ?? [];
    return rows.map((r) => ({
      id: Number(r.id),
      actorName: String(r.display_name ?? "System"),
      actorUsername: String(r.username ?? ""),
      action: String(r.action),
      entityType: String(r.entity_type),
      entityId: String(r.entity_id),
      fromStatus: String(r.from_status ?? ""),
      toStatus: String(r.to_status ?? ""),
      detail: String(r.detail ?? ""),
      createdAt: String(r.created_at ?? ""),
    }));
  });
}

/** Everything recorded against one entity — its history in one place. */
export async function listFor(entityType: string, entityId: string | number): Promise<AuditEvent[]> {
  return withDb("listAuditFor", async (db) => {
    const rows = (await db.execute(
      `SELECT a.*, u.display_name, u.username
         FROM audit_events a
         LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.entity_type = ? AND a.entity_id = ?
        ORDER BY a.created_at DESC, a.id DESC;`, [entityType, String(entityId)])).rows ?? [];
    return rows.map((r) => ({
      id: Number(r.id),
      actorName: String(r.display_name ?? "System"),
      actorUsername: String(r.username ?? ""),
      action: String(r.action),
      entityType: String(r.entity_type),
      entityId: String(r.entity_id),
      fromStatus: String(r.from_status ?? ""),
      toStatus: String(r.to_status ?? ""),
      detail: String(r.detail ?? ""),
      createdAt: String(r.created_at ?? ""),
    }));
  });
}
