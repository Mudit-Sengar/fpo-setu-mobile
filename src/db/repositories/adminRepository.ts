import { withDb, withWrite } from "../connection";
import { AuthzError, requireAdmin, type SessionContext } from "../authz";
import { record } from "./auditRepository";
import { hashPassword } from "../../lib/crypto/password";
import type { RoleCode } from "./authRepository";
import { writeBuyerRequirementsTx, type RequirementsUpdate } from "./readinessRepository";

/**
 * Administration: accounts, roles, profile links, and taking a party out of the
 * market.
 *
 * Admin was an access grant — a way to open the other views — so everything only
 * an administrator does had nowhere to live. Every function here is gated on the
 * role rather than on a profile, because an admin acts as themselves, and every
 * one of them writes an audit row, because these are the actions that change
 * somebody else's account.
 */

export interface AdminUserRow {
  id: number;
  username: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
  roles: RoleCode[];
  /** One line per linked profile, e.g. "fpo → Samruddha". */
  profiles: { role: string; partyId: number; name: string }[];
}

export interface AdminPartyRow {
  partyId: number;
  kind: string;
  entityId: string;
  name: string;
  isActive: boolean;
  /** Rows that would be orphaned by a hard delete — why these are deactivated. */
  orderCount: number;
}

/* --------------------------------------------------------------- reading -- */

export async function listUsers(ctx: SessionContext | null): Promise<AdminUserRow[]> {
  requireAdmin(ctx);
  return withDb("adminListUsers", async (db) => {
    const users = (await db.execute(
      "SELECT id, username, display_name, is_active, created_at FROM users ORDER BY username;")).rows ?? [];

    return Promise.all(users.map(async (u) => {
      const id = Number(u.id);
      const roles = ((await db.execute(
        "SELECT role_code FROM user_roles WHERE user_id = ? ORDER BY role_code;", [id])).rows ?? [])
        .map((r) => String(r.role_code) as RoleCode);
      const profiles = ((await db.execute(
        `SELECT up.role_code, up.party_id, v.name
           FROM user_profiles up
           LEFT JOIN v_parties v ON v.party_id = up.party_id
          WHERE up.user_id = ? ORDER BY up.role_code;`, [id])).rows ?? [])
        .map((r) => ({
          role: String(r.role_code),
          partyId: Number(r.party_id),
          name: String(r.name ?? ""),
        }));
      return {
        id,
        username: String(u.username),
        displayName: String(u.display_name ?? u.username),
        isActive: Number(u.is_active ?? 0) === 1,
        createdAt: String(u.created_at ?? ""),
        roles,
        profiles,
      };
    }));
  });
}

export async function listParties(ctx: SessionContext | null): Promise<AdminPartyRow[]> {
  requireAdmin(ctx);
  return withDb("adminListParties", async (db) => {
    const rows = (await db.execute(
      `SELECT p.id AS party_id, p.kind, p.entity_id, p.is_active, v.name,
              (SELECT COUNT(*) FROM orders o
                WHERE o.seller_party_id = p.id OR o.buyer_party_id = p.id) AS order_count
         FROM parties p
         LEFT JOIN v_parties v ON v.party_id = p.id
        ORDER BY p.kind, v.name;`)).rows ?? [];
    return rows.map((r) => ({
      partyId: Number(r.party_id),
      kind: String(r.kind),
      entityId: String(r.entity_id),
      name: String(r.name ?? r.entity_id),
      isActive: Number(r.is_active ?? 0) === 1,
      orderCount: Number(r.order_count ?? 0),
    }));
  });
}

/** Orders in dispute, and reviews, for the moderation queue. */
export async function listDisputes(
  ctx: SessionContext | null,
): Promise<{ id: number; orderNo: string; sellerName: string; buyerName: string; commodity: string; totalAmount: number }[]> {
  requireAdmin(ctx);
  return withDb("adminListDisputes", async (db) => {
    const rows = (await db.execute(
      `SELECT o.id, o.order_no, o.commodity, o.total_amount, s.name AS seller_name, b.name AS buyer_name
         FROM orders o
         JOIN v_parties s ON s.party_id = o.seller_party_id
         JOIN v_parties b ON b.party_id = o.buyer_party_id
        WHERE o.status = 'disputed' ORDER BY o.updated_at DESC;`)).rows ?? [];
    return rows.map((r) => ({
      id: Number(r.id),
      orderNo: String(r.order_no ?? ""),
      sellerName: String(r.seller_name ?? ""),
      buyerName: String(r.buyer_name ?? ""),
      commodity: String(r.commodity ?? ""),
      totalAmount: Number(r.total_amount ?? 0),
    }));
  });
}

/** Entities with no user linked, for the profile-linking screen. */
export async function listLinkableParties(
  ctx: SessionContext | null, kind: string,
): Promise<{ partyId: number; name: string; entityId: string }[]> {
  requireAdmin(ctx);
  return withDb("adminListLinkable", async (db) => {
    const rows = (await db.execute(
      `SELECT p.id AS party_id, p.entity_id, v.name
         FROM parties p LEFT JOIN v_parties v ON v.party_id = p.id
        WHERE p.kind = ? AND p.is_active = 1 ORDER BY v.name;`, [kind])).rows ?? [];
    return rows.map((r) => ({
      partyId: Number(r.party_id),
      entityId: String(r.entity_id),
      name: String(r.name ?? r.entity_id),
    }));
  });
}

/* --------------------------------------------------------------- writing -- */

/** Creates an account. The password is hashed before it reaches the database. */
export async function createUser(
  ctx: SessionContext | null, username: string, password: string, displayName: string,
): Promise<number> {
  requireAdmin(ctx);
  const name = username.trim().toLowerCase();
  if (name === "") throw new AuthzError("A username is required.");
  if (password.length < 4) throw new AuthzError("Choose a longer password.");

  // Hashing is CPU-bound; do it before the write so the lock is held briefly.
  const hash = hashPassword(password);

  return withWrite("adminCreateUser", async (db) => {
    const taken = (await db.execute(
      "SELECT 1 AS ok FROM users WHERE username = ?;", [name])).rows ?? [];
    if (taken.length > 0) throw new AuthzError("That username is already taken.");

    await db.execute(
      "INSERT INTO users (username, password_hash, display_name) VALUES (?,?,?);",
      [name, hash, displayName.trim() === "" ? name : displayName.trim()]);
    const created = (await db.execute("SELECT id FROM users WHERE username = ?;", [name])).rows ?? [];
    const userId = Number(created[0].id);

    await record(db, ctx, {
      action: "user_created", entityType: "user", entityId: userId, detail: name,
    });
    return userId;
  });
}

/**
 * Enables or disables an account.
 *
 * Disabling is how access is removed: the session is re-validated against the
 * database on every launch, so a disabled account cannot keep using a stored
 * session. Deleting the row would take its audit trail with it.
 */
export async function setUserActive(
  ctx: SessionContext | null, userId: number, active: boolean,
): Promise<void> {
  const actorId = requireAdmin(ctx);
  if (userId === actorId && !active) {
    throw new AuthzError("You cannot disable your own account.");
  }

  await withWrite("adminSetUserActive", async (db) => {
    const rows = (await db.execute(
      "SELECT is_active, username FROM users WHERE id = ?;", [userId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("No such account.");

    await db.execute("UPDATE users SET is_active = ? WHERE id = ?;", [active ? 1 : 0, userId]);
    await record(db, ctx, {
      action: active ? "user_enabled" : "user_disabled",
      entityType: "user", entityId: userId,
      fromStatus: Number(rows[0].is_active) === 1 ? "active" : "disabled",
      toStatus: active ? "active" : "disabled",
      detail: String(rows[0].username ?? ""),
    });
  });
}

export async function setUserRole(
  ctx: SessionContext | null, userId: number, role: RoleCode, granted: boolean,
): Promise<void> {
  const actorId = requireAdmin(ctx);
  if (userId === actorId && role === "admin" && !granted) {
    throw new AuthzError("You cannot remove your own admin role.");
  }

  await withWrite("adminSetUserRole", async (db) => {
    if (granted) {
      await db.execute(
        "INSERT OR IGNORE INTO user_roles (user_id, role_code) VALUES (?, ?);", [userId, role]);
    } else {
      await db.execute(
        "DELETE FROM user_roles WHERE user_id = ? AND role_code = ?;", [userId, role]);
    }
    await record(db, ctx, {
      action: granted ? "role_granted" : "role_revoked",
      entityType: "user", entityId: userId, detail: role,
    });
  });
}

/**
 * Points an account at an entity for one role.
 *
 * This is what makes an account usable: without it, sign-in fails with
 * `no_profile` rather than silently borrowing the first record in the table.
 */
export async function linkProfile(
  ctx: SessionContext | null, userId: number, role: string, partyId: number,
): Promise<void> {
  requireAdmin(ctx);

  await withWrite("adminLinkProfile", async (db) => {
    const party = (await db.execute(
      "SELECT kind FROM parties WHERE id = ?;", [partyId])).rows ?? [];
    if (party.length === 0) throw new AuthzError("No such party.");
    if (String(party[0].kind) !== role) {
      throw new AuthzError(`That party is a ${String(party[0].kind)}, not a ${role}.`);
    }

    await db.execute(
      `INSERT INTO user_profiles (user_id, role_code, party_id) VALUES (?,?,?)
       ON CONFLICT (user_id, role_code) DO UPDATE SET party_id = excluded.party_id;`,
      [userId, role, partyId]);
    // A profile is only usable with the matching role, so grant it together.
    await db.execute(
      "INSERT OR IGNORE INTO user_roles (user_id, role_code) VALUES (?, ?);", [userId, role]);

    await record(db, ctx, {
      action: "profile_linked", entityType: "user", entityId: userId,
      detail: `${role} -> party ${partyId}`,
    });
  });
}

/**
 * Takes a party out of the market, or puts it back.
 *
 * Deactivation rather than deletion, deliberately: `orders` holds the two party
 * columns with `ON DELETE RESTRICT`, so removing an FPO would either fail or, if
 * it succeeded, erase a farmer's payment record. An inactive party disappears
 * from matching and cannot be connected to, and everything it did remains.
 */
export async function setPartyActive(
  ctx: SessionContext | null, partyId: number, active: boolean,
): Promise<void> {
  requireAdmin(ctx);

  await withWrite("adminSetPartyActive", async (db) => {
    const rows = (await db.execute(
      "SELECT kind, entity_id, is_active FROM parties WHERE id = ?;", [partyId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("No such party.");

    await db.execute("UPDATE parties SET is_active = ? WHERE id = ?;", [active ? 1 : 0, partyId]);

    // Their open postings go with them: leaving them visible would let buyers
    // reply to an organisation that can no longer answer.
    if (!active) {
      await db.execute(
        `UPDATE requests SET status = 'cancelled', updated_at = datetime('now')
          WHERE author_party_id = ? AND status = 'open';`, [partyId]);
    }

    await record(db, ctx, {
      action: active ? "party_reactivated" : "party_deactivated",
      entityType: "party", entityId: partyId,
      fromStatus: Number(rows[0].is_active) === 1 ? "active" : "inactive",
      toStatus: active ? "active" : "inactive",
      detail: `${String(rows[0].kind)} ${String(rows[0].entity_id)}`,
    });
  });
}

/** Settles a disputed order, back to delivered or cancelled. */
export async function resolveDispute(
  ctx: SessionContext | null, orderId: number, to: "delivered" | "cancelled", note: string,
): Promise<void> {
  requireAdmin(ctx);

  await withWrite("adminResolveDispute", async (db) => {
    const rows = (await db.execute(
      "SELECT status, order_no FROM orders WHERE id = ?;", [orderId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("No such order.");
    if (String(rows[0].status) !== "disputed") {
      throw new AuthzError("That order is not in dispute.");
    }

    await db.execute(
      "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?;", [to, orderId]);
    await record(db, ctx, {
      action: "dispute_resolved", entityType: "order", entityId: orderId,
      fromStatus: "disputed", toStatus: to, detail: note,
    });
  });
}

/**
 * Advances a service request on a provider's behalf.
 *
 * Lenders, auditors and mentors have parties but no logins yet, so nobody can
 * open their queue. Until they do, the platform operator processes these — and
 * the audit row says an admin did it rather than pretending the provider
 * answered, which is the point of recording it at all.
 */
export async function advanceServiceRequest(
  ctx: SessionContext | null, requestId: number,
  to: "in_review" | "approved" | "rejected" | "completed",
): Promise<void> {
  requireAdmin(ctx);

  await withWrite("adminAdvanceService", async (db) => {
    const rows = (await db.execute(
      "SELECT status, requester_party_id, subject FROM service_requests WHERE id = ?;",
      [requestId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("No such request.");
    const from = String(rows[0].status);
    if (from === "approved" && to !== "completed") {
      throw new AuthzError("An approved request can only be completed.");
    }
    if (["rejected", "completed", "withdrawn"].includes(from)) {
      throw new AuthzError("That request is already settled.");
    }

    await db.execute(
      "UPDATE service_requests SET status = ?, decided_at = datetime('now'), decided_by_user_id = ? WHERE id = ?;",
      [to, ctx!.userId, requestId]);

    await db.execute(
      `INSERT INTO notifications (recipient_party_id, type, title, body)
       VALUES (?,?,?,?);`,
      [Number(rows[0].requester_party_id), `service_${to}`,
        to === "approved" ? "Your request was approved"
          : to === "rejected" ? "Your request was declined" : "Request updated",
        String(rows[0].subject ?? "")]);

    await record(db, ctx, {
      action: "service_decided_by_admin", entityType: "service_request", entityId: requestId,
      fromStatus: from, toStatus: to,
    });
  });
}

/** Every service request, for the operator desk. */
export async function listAllServiceRequests(
  ctx: SessionContext | null,
): Promise<{ id: number; requesterName: string; providerName: string; serviceType: string; subject: string; status: string; amount: number | null }[]> {
  requireAdmin(ctx);
  return withDb("adminListServiceRequests", async (db) => {
    const rows = (await db.execute(
      `SELECT sr.id, sr.service_type, sr.subject, sr.status, sr.amount_requested,
              req.name AS requester_name, prov.name AS provider_name
         FROM service_requests sr
         JOIN v_parties req  ON req.party_id  = sr.requester_party_id
         JOIN v_parties prov ON prov.party_id = sr.provider_party_id
        ORDER BY sr.created_at DESC, sr.id DESC;`)).rows ?? [];
    return rows.map((r) => ({
      id: Number(r.id),
      requesterName: String(r.requester_name ?? ""),
      providerName: String(r.provider_name ?? ""),
      serviceType: String(r.service_type),
      subject: String(r.subject ?? ""),
      status: String(r.status),
      amount: r.amount_requested == null ? null : Number(r.amount_requested),
    }));
  });
}

/**
 * Sets one buyer's requirements on their behalf.
 *
 * Buyers b-2 through b-6 have a party and a requirements row but no login of
 * their own yet — the same situation lenders and auditors are in on the service
 * desk above. Until a buyer has an account, an administrator maintains what they
 * require so the Market-Linked Growth Planning screen has more than one buyer to
 * assess an FPO against.
 */
export async function updateBuyerRequirements(
  ctx: SessionContext | null, buyerId: string, input: RequirementsUpdate,
): Promise<void> {
  requireAdmin(ctx);

  await withWrite("adminUpdateBuyerRequirements", (db) => db.transaction(async (tx) => {
    await writeBuyerRequirementsTx(tx, buyerId, input);
    await record(tx, ctx, {
      action: "buyer_requirements_updated", entityType: "buyer", entityId: buyerId,
    });
  }));
}

/** Removes a review. Moderation of last resort, and always recorded. */
export async function removeReview(
  ctx: SessionContext | null, reviewId: number, reason: string,
): Promise<void> {
  requireAdmin(ctx);
  if (reason.trim() === "") throw new AuthzError("Give a reason for removing a review.");

  await withWrite("adminRemoveReview", async (db) => {
    const rows = (await db.execute(
      "SELECT subject_party_id, note FROM reviews_v2 WHERE id = ?;", [reviewId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("No such review.");

    await db.execute("DELETE FROM reviews_v2 WHERE id = ?;", [reviewId]);
    await record(db, ctx, {
      action: "review_removed", entityType: "review", entityId: reviewId,
      detail: reason.trim(),
    });
  });
}
