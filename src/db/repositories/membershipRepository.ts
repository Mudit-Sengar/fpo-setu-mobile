import { withDb, withWrite } from "../connection";
import { AuthzError, requireProfile, type SessionContext } from "../authz";
import { notifyParty, partyIdFor } from "./networkRepository";
import { record } from "./auditRepository";

/**
 * Farmer ↔ FPO membership.
 *
 * Replaces the scalar `farmers.fpo_id`, which could say only "belongs" or
 * "doesn't". Applying, being approved, being turned down and leaving are all
 * different things, and each of them is something the other side needs to see.
 *
 * Ownership rules enforced here:
 *  - a farmer applies only for themselves;
 *  - only the FPO applied to may approve or reject;
 *  - a farmer may leave, but cannot approve their own application.
 */

export type MembershipStatus = "pending" | "active" | "rejected" | "suspended" | "exited";

export interface MembershipRow {
  id: number;
  farmerId: string;
  fpoId: string;
  fpoName: string;
  farmerName: string;
  village: string;
  district: string;
  landAcres: number;
  crops: string[];
  status: MembershipStatus;
  sharePct: number;
  applicationNote: string;
  contactPhone: string;
  appliedAt: string;
  joinedAt: string;
}

export interface EngagementRow {
  membershipId: number;
  farmerId: string;
  name: string;
  village: string;
  soldThroughFPO: number;
  trainings: number;
  lastTxn: string;
  status: "Active" | "At-risk" | "Dormant";
}

const MEMBERSHIP_SELECT = `
  SELECT m.*, f.name AS farmer_name, f.village, f.district, f.land_acres, o.name AS fpo_name
    FROM memberships m
    JOIN farmers f ON f.id = m.farmer_id
    JOIN fpos o    ON o.id = m.fpo_id`;

async function hydrate(
  db: { execute: (sql: string, p?: (string | number)[]) => Promise<{ rows?: Record<string, unknown>[] }> },
  r: Record<string, unknown>,
): Promise<MembershipRow> {
  const farmerId = String(r.farmer_id);
  const crops = ((await db.execute(
    "SELECT crop FROM farmer_crops WHERE farmer_id = ?;", [farmerId])).rows ?? [])
    .map((x) => String(x.crop));
  return {
    id: Number(r.id),
    farmerId,
    fpoId: String(r.fpo_id),
    fpoName: String(r.fpo_name ?? ""),
    farmerName: String(r.farmer_name ?? ""),
    village: String(r.village ?? ""),
    district: String(r.district ?? ""),
    landAcres: Number(r.land_acres ?? 0),
    crops,
    status: String(r.status) as MembershipStatus,
    sharePct: Number(r.share_pct ?? 0),
    applicationNote: String(r.application_note ?? ""),
    contactPhone: String(r.contact_phone ?? ""),
    appliedAt: String(r.applied_at ?? ""),
    joinedAt: String(r.joined_at ?? ""),
  };
}

/* --------------------------------------------------------------- reading -- */

/** The farmer's current active membership, or null when they belong to no FPO. */
export async function getActiveMembership(farmerId: string): Promise<MembershipRow | null> {
  return withDb("getActiveMembership", async (db) => {
    const rows = (await db.execute(
      `${MEMBERSHIP_SELECT} WHERE m.farmer_id = ? AND m.status = 'active' LIMIT 1;`,
      [farmerId])).rows ?? [];
    return rows.length === 0 ? null : hydrate(db, rows[0]);
  });
}

/** Every membership a farmer has ever had, so they can see pending and rejected. */
export async function listFarmerMemberships(farmerId: string | null): Promise<MembershipRow[]> {
  if (farmerId == null) return [];
  return withDb("listFarmerMemberships", async (db) => {
    const rows = (await db.execute(
      `${MEMBERSHIP_SELECT} WHERE m.farmer_id = ? ORDER BY m.applied_at DESC, m.id DESC;`,
      [farmerId])).rows ?? [];
    return Promise.all(rows.map((r) => hydrate(db, r)));
  });
}

/** Applications waiting on this FPO. */
export async function listApplicants(ctx: SessionContext | null): Promise<MembershipRow[]> {
  if (ctx == null) return [];
  return withDb("listApplicants", async (db) => {
    const rows = (await db.execute(
      `${MEMBERSHIP_SELECT} WHERE m.fpo_id = ? AND m.status = 'pending'
        ORDER BY m.applied_at, m.id;`, [ctx.profileId])).rows ?? [];
    return Promise.all(rows.map((r) => hydrate(db, r)));
  });
}

/** The FPO's active roster, with engagement derived from real activity. */
export async function listEngagement(fpoId: string): Promise<EngagementRow[]> {
  return withDb("listEngagement", async (db) => {
    const rows = (await db.execute(
      "SELECT * FROM v_member_engagement WHERE fpo_id = ? ORDER BY name;", [fpoId])).rows ?? [];
    return rows.map((r) => ({
      membershipId: Number(r.membership_id),
      farmerId: String(r.farmer_id),
      name: String(r.name),
      village: String(r.village ?? ""),
      soldThroughFPO: Number(r.sold_through_fpo ?? 0),
      trainings: Number(r.trainings ?? 0),
      lastTxn: String(r.last_txn ?? ""),
      status: String(r.status) as EngagementRow["status"],
    }));
  });
}

/** Active member count for an FPO — the real number, not the seeded column. */
export async function countActiveMembers(fpoId: string): Promise<number> {
  return withDb("countActiveMembers", async (db) => {
    const rows = (await db.execute(
      "SELECT COUNT(*) AS n FROM memberships WHERE fpo_id = ? AND status = 'active';",
      [fpoId])).rows ?? [];
    return Number(rows[0]?.n ?? 0);
  });
}

/* --------------------------------------------------------------- writing -- */

export interface ApplicationInput {
  fpoId: string;
  note?: string | null;
  contactPhone?: string | null;
  /** Corrections the applicant made to their own profile on the form. */
  village?: string | null;
  landAcres?: number | null;
  crops?: string[] | null;
}

/**
 * Applies to join an FPO.
 *
 * The applicant is the session, never a parameter. Profile corrections typed on
 * the form update the farmer's own record; the note and phone stay on the
 * membership, because they were given to this FPO for this application.
 */
export async function apply(
  ctx: SessionContext | null, input: ApplicationInput,
): Promise<number> {
  const farmerId = requireProfile(ctx, "farmer");

  return withWrite("applyForMembership", async (db) => {
    const active = (await db.execute(
      "SELECT fpo_id FROM memberships WHERE farmer_id = ? AND status = 'active';",
      [farmerId])).rows ?? [];
    if (active.length > 0) {
      throw new AuthzError(String(active[0].fpo_id) === input.fpoId
        ? "You are already a member of this FPO."
        : "Leave your current FPO before applying to another.");
    }

    const pending = (await db.execute(
      "SELECT id FROM memberships WHERE farmer_id = ? AND fpo_id = ? AND status = 'pending';",
      [farmerId, input.fpoId])).rows ?? [];
    if (pending.length > 0) {
      throw new AuthzError("You have already applied to this FPO.");
    }

    if (input.village != null && input.village !== "") {
      await db.execute("UPDATE farmers SET village = ? WHERE id = ?;", [input.village, farmerId]);
    }
    if (input.landAcres != null && input.landAcres > 0) {
      await db.execute("UPDATE farmers SET land_acres = ? WHERE id = ?;", [input.landAcres, farmerId]);
    }
    if (input.crops != null && input.crops.length > 0) {
      await db.execute("DELETE FROM farmer_crops WHERE farmer_id = ?;", [farmerId]);
      for (const crop of input.crops) {
        await db.execute(
          "INSERT OR IGNORE INTO farmer_crops (farmer_id, crop) VALUES (?, ?);", [farmerId, crop]);
      }
    }

    await db.execute(
      `INSERT INTO memberships (farmer_id, fpo_id, status, application_note, contact_phone)
       VALUES (?, ?, 'pending', ?, ?);`,
      [farmerId, input.fpoId, input.note ?? null, input.contactPhone ?? null]);

    const created = (await db.execute(
      `SELECT id FROM memberships WHERE farmer_id = ? AND fpo_id = ? AND status = 'pending';`,
      [farmerId, input.fpoId])).rows ?? [];
    const membershipId = Number(created[0].id);

    const fpoParty = await partyIdFor("fpo", input.fpoId);
    if (fpoParty != null) {
      await notifyParty(db, {
        recipient: fpoParty,
        actor: ctx!.partyId,
        type: "membership_application",
        title: "New membership application",
        body: input.note ?? null,
      });
    }

    return membershipId;
  });
}

/**
 * Approves or rejects an application.
 *
 * Ownership is checked against the membership's FPO, not against anything the
 * caller passed, so an FPO can only decide applications addressed to it.
 */
export async function decide(
  ctx: SessionContext | null, membershipId: number,
  decision: "active" | "rejected", sharePct = 0,
): Promise<void> {
  const fpoId = requireProfile(ctx, "fpo");

  await withWrite("decideMembership", async (db) => {
    const rows = (await db.execute(
      "SELECT farmer_id, fpo_id, status FROM memberships WHERE id = ?;", [membershipId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That application no longer exists.");
    if (String(rows[0].fpo_id) !== fpoId) {
      throw new AuthzError("Only the FPO applied to can decide this application.");
    }
    if (String(rows[0].status) !== "pending") {
      throw new AuthzError("That application has already been decided.");
    }
    const farmerId = String(rows[0].farmer_id);

    if (decision === "active") {
      // The partial unique index would reject this anyway; failing here gives the
      // FPO a sentence rather than a constraint error.
      const elsewhere = (await db.execute(
        "SELECT 1 AS ok FROM memberships WHERE farmer_id = ? AND status = 'active';",
        [farmerId])).rows ?? [];
      if (elsewhere.length > 0) {
        throw new AuthzError("That farmer has since joined another FPO.");
      }
    }

    await db.execute(
      `UPDATE memberships
          SET status = ?, share_pct = ?, decided_at = datetime('now'),
              joined_at = CASE WHEN ? = 'active' THEN datetime('now') ELSE joined_at END,
              decided_by_user_id = ?
        WHERE id = ?;`,
      [decision, sharePct, decision, ctx!.userId, membershipId]);

    const farmerParty = await partyIdFor("farmer", farmerId);
    if (farmerParty != null) {
      await notifyParty(db, {
        recipient: farmerParty,
        actor: ctx!.partyId,
        type: `membership_${decision}`,
        title: decision === "active" ? "Membership approved" : "Membership not approved",
        body: null,
      });
    }
    await record(db, ctx, {
      action: "membership_decided", entityType: "membership", entityId: membershipId,
      fromStatus: "pending", toStatus: decision, detail: farmerId,
    });
  });
}

/** The farmer's side: leaves their FPO, preserving the history. */
export async function leave(ctx: SessionContext | null, membershipId: number): Promise<void> {
  const farmerId = requireProfile(ctx, "farmer");

  await withWrite("leaveMembership", async (db) => {
    const rows = (await db.execute(
      "SELECT farmer_id, fpo_id, status FROM memberships WHERE id = ?;", [membershipId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That membership no longer exists.");
    if (String(rows[0].farmer_id) !== farmerId) {
      throw new AuthzError("You can only leave your own membership.");
    }
    if (String(rows[0].status) !== "active") {
      throw new AuthzError("You are not an active member of that FPO.");
    }

    await db.execute(
      "UPDATE memberships SET status = 'exited', exited_at = datetime('now') WHERE id = ?;",
      [membershipId]);

    const fpoParty = await partyIdFor("fpo", String(rows[0].fpo_id));
    if (fpoParty != null) {
      await notifyParty(db, {
        recipient: fpoParty,
        actor: ctx!.partyId,
        type: "membership_exited",
        title: "A member has left",
        body: null,
      });
    }
  });
}

/**
 * Opens (or reuses) the FPO's outreach thread with one of its members.
 *
 * This is what "Intervene" on an at-risk member does. The thread hangs off the
 * membership rather than a connection, because the membership already is the
 * relationship between these two parties — there is nothing to connect.
 */
export async function openMemberThread(
  ctx: SessionContext | null, membershipId: number, firstMessage: string,
): Promise<number> {
  const fpoId = requireProfile(ctx, "fpo");

  return withWrite("openMemberThread", async (db) => {
    const rows = (await db.execute(
      "SELECT farmer_id, fpo_id, status FROM memberships WHERE id = ?;", [membershipId])).rows ?? [];
    if (rows.length === 0) throw new AuthzError("That membership no longer exists.");
    if (String(rows[0].fpo_id) !== fpoId) {
      throw new AuthzError("That member belongs to another FPO.");
    }
    const farmerParty = await partyIdFor("farmer", String(rows[0].farmer_id));
    if (farmerParty == null) throw new AuthzError("That member is not reachable.");

    const existing = (await db.execute(
      "SELECT id FROM conversations WHERE membership_id = ?;", [membershipId])).rows ?? [];
    let conversationId: number;
    if (existing.length > 0) {
      conversationId = Number(existing[0].id);
    } else {
      await db.execute("INSERT INTO conversations (membership_id) VALUES (?);", [membershipId]);
      const created = (await db.execute(
        "SELECT id FROM conversations WHERE membership_id = ?;", [membershipId])).rows ?? [];
      conversationId = Number(created[0].id);
      for (const partyId of [ctx!.partyId, farmerParty]) {
        await db.execute(
          "INSERT OR IGNORE INTO conversation_participants (conversation_id, party_id) VALUES (?, ?);",
          [conversationId, partyId]);
      }
    }

    const text = firstMessage.trim();
    if (text !== "") {
      await db.execute(
        "INSERT INTO messages (conversation_id, sender_party_id, body) VALUES (?,?,?);",
        [conversationId, ctx!.partyId, text]);
      await notifyParty(db, {
        recipient: farmerParty,
        actor: ctx!.partyId,
        type: "message",
        title: "Message from your FPO",
        body: text.slice(0, 120),
        conversationId,
      });
    }
    return conversationId;
  });
}

/**
 * Notifies every active member of a meeting.
 *
 * Writes one invitation per member, so the number reported to the FPO is the
 * number of rows actually written rather than a count read off a column.
 * Returns how many were invited.
 */
export async function inviteMembersToMeeting(
  ctx: SessionContext | null, meetingId: number,
): Promise<number> {
  const fpoId = requireProfile(ctx, "fpo");

  return withWrite("inviteMembersToMeeting", async (db) => {
    const owns = (await db.execute(
      "SELECT 1 AS ok FROM fpo_meetings WHERE id = ? AND fpo_id = ?;",
      [meetingId, fpoId])).rows ?? [];
    if (owns.length === 0) throw new AuthzError("That meeting belongs to another FPO.");

    const members = (await db.execute(
      "SELECT id, farmer_id FROM memberships WHERE fpo_id = ? AND status = 'active';",
      [fpoId])).rows ?? [];

    for (const m of members) {
      await db.execute(
        "INSERT OR IGNORE INTO meeting_invitations (meeting_id, membership_id) VALUES (?, ?);",
        [meetingId, Number(m.id)]);
      const party = await partyIdFor("farmer", String(m.farmer_id));
      if (party != null) {
        await notifyParty(db, {
          recipient: party,
          actor: ctx!.partyId,
          type: "meeting_invitation",
          title: "FPO meeting scheduled",
          body: null,
        });
      }
    }
    return members.length;
  });
}
