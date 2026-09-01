import { withDb, withWrite } from "../connection";
import { AuthzError, type SessionContext } from "../authz";
import { record } from "./auditRepository";

/**
 * Connections, conversations and notifications — the party-to-party graph that
 * exists independently of any single posting.
 *
 * A request/response says "I am answering this specific thing". A connection says
 * "we know each other", which is what a chat thread hangs off and what survives
 * after the posting that introduced the two of them is closed.
 *
 * Three rules live here rather than in the screens:
 *  - you cannot connect to yourself;
 *  - only the addressee decides a pending request;
 *  - only a participant can read or post to a thread.
 */

export type RelationType = "trade" | "supply" | "peer" | "advisory" | "service";
export type ConnectionStatus = "pending" | "accepted" | "rejected" | "blocked" | "withdrawn";

export interface ConnectionRow {
  id: number;
  requesterPartyId: number;
  addresseePartyId: number;
  /** The party on the other side of this connection, from the caller's view. */
  otherPartyId: number;
  otherName: string;
  otherKind: string;
  otherEntityId: string;
  /** True when the caller sent it, so the UI knows whether it can be decided. */
  outgoing: boolean;
  relationType: RelationType;
  status: ConnectionStatus;
  message: string;
  createdAt: string;
  conversationId: number | null;
  unreadCount: number;
}

export interface MessageRow {
  id: number;
  conversationId: number;
  senderPartyId: number;
  senderName: string;
  /** True when the caller sent it — drives which side of the thread it renders on. */
  mine: boolean;
  body: string;
  createdAt: string;
}

export interface NotificationRow {
  id: number;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  connectionId: number | null;
  conversationId: number | null;
  requestId: number | null;
  responseId: number | null;
  orderId: number | null;
  serviceRequestId: number | null;
}

/* --------------------------------------------------------------- reading -- */

/**
 * `other` resolves to whichever side of the pair is not the caller, so one query
 * serves both the sent and received lists.
 *
 * The caller's party id is bound once through a `me` CTE rather than repeated as
 * five identical placeholders. Named parameters would read better still, but
 * support for them differs between op-sqlite and other drivers, and every caller
 * appends its own `?` clauses after this — so `me` is always parameter one.
 */
const CONNECTION_SELECT = `
  WITH me(id) AS (SELECT ?)
  SELECT c.*,
         CASE WHEN c.requester_party_id = me.id THEN c.addressee_party_id ELSE c.requester_party_id END AS other_party_id,
         other.name AS other_name, other.kind AS other_kind, other.entity_id AS other_entity_id,
         conv.id AS conversation_id,
         (SELECT COUNT(*) FROM messages m
            JOIN conversation_participants cp
              ON cp.conversation_id = m.conversation_id AND cp.party_id = me.id
           WHERE m.conversation_id = conv.id
             AND m.sender_party_id <> me.id
             AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)) AS unread_count
    FROM connections c
    CROSS JOIN me
    JOIN v_parties other
      ON other.party_id = CASE WHEN c.requester_party_id = me.id THEN c.addressee_party_id ELSE c.requester_party_id END
    LEFT JOIN conversations conv ON conv.connection_id = c.id`;

function toConnection(r: Record<string, unknown>, me: number): ConnectionRow {
  return {
    id: Number(r.id),
    requesterPartyId: Number(r.requester_party_id),
    addresseePartyId: Number(r.addressee_party_id),
    otherPartyId: Number(r.other_party_id),
    otherName: String(r.other_name ?? ""),
    otherKind: String(r.other_kind ?? ""),
    otherEntityId: String(r.other_entity_id ?? ""),
    outgoing: Number(r.requester_party_id) === me,
    relationType: String(r.relation_type) as RelationType,
    status: String(r.status) as ConnectionStatus,
    message: String(r.message ?? ""),
    createdAt: String(r.created_at ?? ""),
    conversationId: r.conversation_id == null ? null : Number(r.conversation_id),
    unreadCount: Number(r.unread_count ?? 0),
  };
}

/** Every connection this session is part of, either side, newest first. */
export async function listConnections(ctx: SessionContext | null): Promise<ConnectionRow[]> {
  if (ctx == null) return [];
  return withDb("listConnections", async (db) => {
    const rows = (await db.execute(
      `${CONNECTION_SELECT}
        WHERE c.requester_party_id = ? OR c.addressee_party_id = ?
        ORDER BY c.created_at DESC, c.id DESC;`,
      [ctx.partyId, ctx.partyId, ctx.partyId],
    )).rows ?? [];
    return rows.map((r) => toConnection(r, ctx.partyId));
  });
}

/** The connection between the caller and one other party, if any. */
export async function getConnectionWith(
  ctx: SessionContext | null, otherPartyId: number, relationType: RelationType,
): Promise<ConnectionRow | null> {
  if (ctx == null) return null;
  const [lo, hi] = orderedPair(ctx.partyId, otherPartyId);
  return withDb("getConnectionWith", async (db) => {
    const rows = (await db.execute(
      `${CONNECTION_SELECT}
        WHERE c.pair_lo = ? AND c.pair_hi = ? AND c.relation_type = ?;`,
      [ctx.partyId, lo, hi, relationType],
    )).rows ?? [];
    return rows.length === 0 ? null : toConnection(rows[0], ctx.partyId);
  });
}

/** Messages in a thread. Empty unless the caller is a participant. */
export async function listMessages(
  ctx: SessionContext | null, conversationId: number,
): Promise<MessageRow[]> {
  if (ctx == null) return [];
  return withDb("listMessages", async (db) => {
    const rows = (await db.execute(
      `SELECT m.*, v.name AS sender_name
         FROM messages m
         JOIN v_parties v ON v.party_id = m.sender_party_id
        WHERE m.conversation_id = ?
          AND EXISTS (SELECT 1 FROM conversation_participants cp
                       WHERE cp.conversation_id = m.conversation_id AND cp.party_id = ?)
        ORDER BY m.created_at, m.id;`,
      [conversationId, ctx.partyId])).rows ?? [];
    return rows.map((r) => ({
      id: Number(r.id),
      conversationId: Number(r.conversation_id),
      senderPartyId: Number(r.sender_party_id),
      senderName: String(r.sender_name ?? ""),
      mine: Number(r.sender_party_id) === ctx.partyId,
      body: String(r.body ?? ""),
      createdAt: String(r.created_at ?? ""),
    }));
  });
}

export interface ConversationRow {
  id: number;
  otherPartyId: number;
  otherName: string;
  otherKind: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string;
}

/**
 * Every conversation the caller is part of, regardless of what opened it —
 * an accepted connection, a reply to a posting (see requestRepository.respond),
 * an FPO's outreach to a member, or a service request. `conversations` always
 * has exactly two participants (nothing in this app opens a group thread), so
 * "the other party" is just "whoever else is in conversation_participants" —
 * one query serves every origin instead of one table per FK.
 */
export async function listMyConversations(ctx: SessionContext | null): Promise<ConversationRow[]> {
  if (ctx == null) return [];
  return withDb("listMyConversations", async (db) => {
    const rows = (await db.execute(
      `WITH me(id) AS (SELECT ?)
       SELECT conv.id,
              other.party_id AS other_party_id, other.name AS other_name, other.kind AS other_kind,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = conv.id AND m.sender_party_id <> me.id
                 AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)) AS unread_count,
              (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = conv.id) AS last_message_at,
              (SELECT body FROM messages m WHERE m.conversation_id = conv.id
                 ORDER BY created_at DESC, id DESC LIMIT 1) AS last_body
         FROM conversations conv
         CROSS JOIN me
         JOIN conversation_participants cp ON cp.conversation_id = conv.id AND cp.party_id = me.id
         JOIN conversation_participants op ON op.conversation_id = conv.id AND op.party_id <> me.id
         JOIN v_parties other ON other.party_id = op.party_id
        ORDER BY last_message_at IS NULL, last_message_at DESC, conv.id DESC;`,
      [ctx.partyId])).rows ?? [];
    return rows.map((r) => ({
      id: Number(r.id),
      otherPartyId: Number(r.other_party_id),
      otherName: String(r.other_name ?? ""),
      otherKind: String(r.other_kind ?? ""),
      unreadCount: Number(r.unread_count ?? 0),
      lastMessageAt: r.last_message_at == null ? null : String(r.last_message_at),
      lastMessagePreview: String(r.last_body ?? ""),
    }));
  });
}

export async function listNotifications(
  ctx: SessionContext | null, onlyUnread = false,
): Promise<NotificationRow[]> {
  if (ctx == null) return [];
  return withDb("listNotifications", async (db) => {
    const rows = (await db.execute(
      `SELECT * FROM notifications
        WHERE recipient_party_id = ? ${onlyUnread ? "AND is_read = 0" : ""}
        ORDER BY created_at DESC, id DESC LIMIT 50;`,
      [ctx.partyId])).rows ?? [];
    return rows.map((r) => ({
      id: Number(r.id),
      type: String(r.type),
      title: String(r.title),
      body: String(r.body ?? ""),
      isRead: Number(r.is_read ?? 0) === 1,
      createdAt: String(r.created_at ?? ""),
      connectionId: r.connection_id == null ? null : Number(r.connection_id),
      conversationId: r.conversation_id == null ? null : Number(r.conversation_id),
      requestId: r.request_id == null ? null : Number(r.request_id),
      responseId: r.response_id == null ? null : Number(r.response_id),
      orderId: r.order_id == null ? null : Number(r.order_id),
      serviceRequestId: r.service_request_id == null ? null : Number(r.service_request_id),
    }));
  });
}

export async function countUnreadNotifications(ctx: SessionContext | null): Promise<number> {
  if (ctx == null) return 0;
  return withDb("countUnreadNotifications", async (db) => {
    const rows = (await db.execute(
      "SELECT COUNT(*) AS n FROM notifications WHERE recipient_party_id = ? AND is_read = 0;",
      [ctx.partyId])).rows ?? [];
    return Number(rows[0]?.n ?? 0);
  });
}

/**
 * The party id backing an entity, or null when it has none.
 *
 * Screens hold entity ids (`s-1`, `fpo-1`) because that is what the domain
 * repositories return, but every relationship is keyed by party. This is the
 * bridge, and it lives here rather than in authRepository because it is about the
 * party graph, not about signing in.
 */
export async function partyIdFor(kind: string, entityId: string): Promise<number | null> {
  return withDb("partyIdFor", async (db) => {
    const rows = (await db.execute(
      "SELECT id FROM parties WHERE kind = ? AND entity_id = ? AND is_active = 1 LIMIT 1;",
      [kind, entityId])).rows ?? [];
    return rows.length === 0 ? null : Number(rows[0].id);
  });
}

/**
 * A service provider's party, looked up by type and name.
 *
 * The mentor and expert lists still render from the legacy directories, which
 * carry no id — name is the only key available until those screens read
 * `service_providers` directly in a later phase.
 */
export async function providerPartyIdByName(
  providerType: string, name: string,
): Promise<number | null> {
  return withDb("providerPartyIdByName", async (db) => {
    const rows = (await db.execute(
      `SELECT p.id FROM service_providers sp
         JOIN parties p ON p.kind = 'service_provider' AND p.entity_id = sp.id
        WHERE sp.provider_type = ? AND sp.name = ? LIMIT 1;`,
      [providerType, name])).rows ?? [];
    return rows.length === 0 ? null : Number(rows[0].id);
  });
}

/* --------------------------------------------------------------- writing -- */

/** The two ids in ascending order, which is what the pair unique index needs. */
function orderedPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

export interface ConnectInput {
  otherPartyId: number;
  relationType: RelationType;
  message?: string | null;
  originRequestId?: number | null;
  /** Opens a thread and posts `message` into it as the first line. */
  openThread?: boolean;
}

/**
 * Asks another party to connect.
 *
 * Re-requesting an existing pair is not an error: a withdrawn or rejected
 * connection returns to pending, which is what a user tapping "Connect" again
 * means. A blocked one stays blocked — that decision is the addressee's to undo.
 *
 * Returns the connection id.
 */
export async function requestConnection(
  ctx: SessionContext | null, input: ConnectInput,
): Promise<number> {
  if (ctx == null) throw new AuthzError("Sign in to connect.");
  if (input.otherPartyId === ctx.partyId) {
    throw new AuthzError("You cannot connect to yourself.");
  }
  const [lo, hi] = orderedPair(ctx.partyId, input.otherPartyId);

  return withWrite("requestConnection", async (db) => {
    const target = (await db.execute(
      "SELECT id, is_active FROM parties WHERE id = ?;", [input.otherPartyId])).rows ?? [];
    if (target.length === 0 || Number(target[0].is_active) !== 1) {
      throw new AuthzError("That party is no longer available.");
    }

    const existing = (await db.execute(
      "SELECT id, status FROM connections WHERE pair_lo = ? AND pair_hi = ? AND relation_type = ?;",
      [lo, hi, input.relationType])).rows ?? [];

    let connectionId: number;
    if (existing.length > 0) {
      connectionId = Number(existing[0].id);
      const status = String(existing[0].status);
      if (status === "blocked") throw new AuthzError("You cannot connect to that party.");
      if (status === "rejected" || status === "withdrawn") {
        await db.execute(
          `UPDATE connections
              SET status = 'pending', requester_party_id = ?, addressee_party_id = ?,
                  message = ?, created_at = datetime('now'), decided_at = NULL,
                  decided_by_user_id = NULL
            WHERE id = ?;`,
          [ctx.partyId, input.otherPartyId, input.message ?? null, connectionId]);
      }
    } else {
      await db.execute(
        `INSERT INTO connections
           (requester_party_id, addressee_party_id, pair_lo, pair_hi, relation_type,
            origin_request_id, status, message)
         VALUES (?,?,?,?,?,?, 'pending', ?);`,
        [ctx.partyId, input.otherPartyId, lo, hi, input.relationType,
          input.originRequestId ?? null, input.message ?? null]);
      const created = (await db.execute(
        "SELECT id FROM connections WHERE pair_lo = ? AND pair_hi = ? AND relation_type = ?;",
        [lo, hi, input.relationType])).rows ?? [];
      connectionId = Number(created[0].id);
    }

    if (input.openThread === true) {
      const conversationId = await ensureThread(db, connectionId, [ctx.partyId, input.otherPartyId]);
      if (input.message != null && input.message.trim() !== "") {
        await db.execute(
          "INSERT INTO messages (conversation_id, sender_party_id, body) VALUES (?,?,?);",
          [conversationId, ctx.partyId, input.message.trim()]);
      }
    }

    await notify(db, {
      recipient: input.otherPartyId,
      actor: ctx.partyId,
      type: "connection_request",
      title: "New connection request",
      body: input.message ?? null,
      connectionId,
    });

    return connectionId;
  });
}

/**
 * Accepts, rejects or blocks a pending request.
 *
 * Only the addressee may decide: the requester deciding their own request would
 * let anyone self-approve into someone else's contact list. Withdrawing is the
 * requester's equivalent and is handled by `withdrawConnection`.
 */
export async function decideConnection(
  ctx: SessionContext | null, connectionId: number,
  decision: "accepted" | "rejected" | "blocked",
): Promise<void> {
  if (ctx == null) throw new AuthzError("You are signed out.");

  await withWrite("decideConnection", async (db) => {
    const rows = (await db.execute(
      "SELECT requester_party_id, addressee_party_id, status FROM connections WHERE id = ?;",
      [connectionId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That request no longer exists.");
    if (Number(rows[0].addressee_party_id) !== ctx.partyId) {
      throw new AuthzError("Only the party who received this request can decide it.");
    }
    if (String(rows[0].status) !== "pending") {
      throw new AuthzError("That request has already been decided.");
    }
    const requester = Number(rows[0].requester_party_id);

    await db.execute(
      `UPDATE connections SET status = ?, decided_at = datetime('now'), decided_by_user_id = ?
        WHERE id = ?;`,
      [decision, ctx.userId, connectionId]);

    if (decision === "accepted") {
      await ensureThread(db, connectionId, [ctx.partyId, requester]);
    }

    await notify(db, {
      recipient: requester,
      actor: ctx.partyId,
      type: `connection_${decision}`,
      title: decision === "accepted" ? "Connection accepted" : "Connection declined",
      body: null,
      connectionId,
    });
    await record(db, ctx, {
      action: "connection_decided", entityType: "connection", entityId: connectionId,
      fromStatus: "pending", toStatus: decision,
    });
  });
}

/** The requester's side: takes back a request they sent. */
export async function withdrawConnection(
  ctx: SessionContext | null, connectionId: number,
): Promise<void> {
  if (ctx == null) throw new AuthzError("You are signed out.");
  await withWrite("withdrawConnection", async (db) => {
    const rows = (await db.execute(
      "SELECT requester_party_id, status FROM connections WHERE id = ?;", [connectionId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That request no longer exists.");
    if (Number(rows[0].requester_party_id) !== ctx.partyId) {
      throw new AuthzError("You can only withdraw a request you sent.");
    }
    if (String(rows[0].status) !== "pending") {
      throw new AuthzError("That request has already been decided.");
    }
    await db.execute(
      "UPDATE connections SET status = 'withdrawn', decided_at = datetime('now') WHERE id = ?;",
      [connectionId]);
  });
}

/**
 * Posts a message into a thread the caller belongs to.
 *
 * Participation is checked against `conversation_participants` rather than the
 * connection, so this keeps working when threads hang off orders or memberships
 * in later phases.
 */
export async function sendMessage(
  ctx: SessionContext | null, conversationId: number, body: string,
): Promise<void> {
  if (ctx == null) throw new AuthzError("Sign in to send a message.");
  const text = body.trim();
  if (text === "") return;

  await withWrite("sendMessage", async (db) => {
    const participants = (await db.execute(
      "SELECT party_id FROM conversation_participants WHERE conversation_id = ?;",
      [conversationId])).rows ?? [];
    const ids = participants.map((p) => Number(p.party_id));
    if (!ids.includes(ctx.partyId)) {
      throw new AuthzError("You are not part of this conversation.");
    }

    await db.execute(
      "INSERT INTO messages (conversation_id, sender_party_id, body) VALUES (?,?,?);",
      [conversationId, ctx.partyId, text]);

    for (const other of ids.filter((id) => id !== ctx.partyId)) {
      await notify(db, {
        recipient: other,
        actor: ctx.partyId,
        type: "message",
        title: "New message",
        body: text.slice(0, 120),
        conversationId,
      });
    }
  });
}

/** Marks a thread read up to now for the caller. */
export async function markThreadRead(
  ctx: SessionContext | null, conversationId: number,
): Promise<void> {
  if (ctx == null) return;
  await withWrite("markThreadRead", (db) => db.execute(
    `UPDATE conversation_participants SET last_read_at = datetime('now')
      WHERE conversation_id = ? AND party_id = ?;`,
    [conversationId, ctx.partyId]));
}

export async function markNotificationsRead(ctx: SessionContext | null): Promise<void> {
  if (ctx == null) return;
  await withWrite("markNotificationsRead", (db) => db.execute(
    "UPDATE notifications SET is_read = 1 WHERE recipient_party_id = ? AND is_read = 0;",
    [ctx.partyId]));
}

/* ------------------------------------------------------------- internals -- */

/**
 * The slice of the driver these helpers need. Written structurally so they accept
 * both a `DB` handle and the transaction object passed to `db.transaction`, which
 * is how requestRepository raises a notification inside its own transaction.
 */
type Bindable = string | number | boolean | null;
interface DbLike {
  execute: (sql: string, params?: Bindable[]) => Promise<{ rows?: Record<string, unknown>[] }>;
}

/** Finds or creates the thread for a connection, with both parties in it. */
async function ensureThread(
  db: DbLike, connectionId: number, participants: number[],
): Promise<number> {
  const existing = (await db.execute(
    "SELECT id FROM conversations WHERE connection_id = ?;", [connectionId])).rows ?? [];
  if (existing.length > 0) return Number(existing[0].id);

  await db.execute("INSERT INTO conversations (connection_id) VALUES (?);", [connectionId]);
  const created = (await db.execute(
    "SELECT id FROM conversations WHERE connection_id = ?;", [connectionId])).rows ?? [];
  const conversationId = Number(created[0].id);

  for (const partyId of participants) {
    await db.execute(
      "INSERT OR IGNORE INTO conversation_participants (conversation_id, party_id) VALUES (?, ?);",
      [conversationId, partyId]);
  }
  return conversationId;
}

interface NotifyInput {
  recipient: number;
  actor: number | null;
  type: string;
  title: string;
  body: string | null;
  connectionId?: number | null;
  requestId?: number | null;
  responseId?: number | null;
  conversationId?: number | null;
  orderId?: number | null;
}

/** Writes one notification. Never notifies a party about its own action. */
async function notify(db: DbLike, n: NotifyInput): Promise<void> {
  if (n.actor != null && n.actor === n.recipient) return;
  await db.execute(
    `INSERT INTO notifications
       (recipient_party_id, actor_party_id, type, title, body,
        connection_id, request_id, response_id, conversation_id, order_id)
     VALUES (?,?,?,?,?,?,?,?,?,?);`,
    [n.recipient, n.actor, n.type, n.title, n.body,
      n.connectionId ?? null, n.requestId ?? null, n.responseId ?? null,
      n.conversationId ?? null, n.orderId ?? null],
  );
}

/**
 * Raises a notification from outside this module — used by requestRepository so a
 * reply and a decision reach the other party the same way a connection does.
 */
export async function notifyParty(db: DbLike, n: NotifyInput): Promise<void> {
  await notify(db, n);
}
