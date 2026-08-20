import { withDb, withWrite } from "../connection";

/**
 * All SQL for identity: users, roles, role assignments and the per-role profile
 * links. Screens never see any of this — they go through src/services/authService,
 * which is what keeps a future swap to a remote backend a one-file change.
 */

/** A role a user can hold. `admin` grants access to all of the others. */
export type RoleCode = "farmer" | "fpo" | "buyer" | "supplier" | "admin";

/**
 * The roles that correspond to an actual app view.
 *
 * `admin` is one of them now. It used to be an access grant only — a way to open
 * the other four views — which left the things only an administrator does
 * (creating accounts, assigning roles, disabling a party) with nowhere to live.
 */
export type ViewRole = RoleCode;

export const VIEW_ROLES: ViewRole[] = ["farmer", "fpo", "buyer", "supplier", "admin"];

/** The roles that resolve to a party. Admin acts as itself, not as an entity. */
export const PROFILE_ROLES: Exclude<ViewRole, "admin">[] = ["farmer", "fpo", "buyer", "supplier"];

export interface UserRow {
  id: number;
  username: string;
  passwordHash: string;
  displayName: string;
  isActive: boolean;
}

export interface RoleRow {
  code: RoleCode;
  label: string;
}

/**
 * The profile a session resolves to.
 *
 * `partyId` is the integer key every relationship table foreign-keys to;
 * `entityId` is the entity's own natural key (farmers.id / fpos.id / ...), which
 * is what the existing screens and repositories still read.
 */
export interface ProfileRef {
  partyId: number;
  entityId: string;
}

/**
 * A view role maps 1:1 onto a party kind. Kept as an explicit map rather than a
 * cast so adding a role that ISN'T a party kind fails to compile here first.
 */
const PARTY_KIND: Record<string, string> = {
  farmer: "farmer",
  fpo: "fpo",
  buyer: "buyer",
  supplier: "supplier",
};

function toUser(r: Record<string, unknown>): UserRow {
  return {
    id: Number(r.id),
    username: String(r.username),
    passwordHash: String(r.password_hash),
    displayName: r.display_name == null ? String(r.username) : String(r.display_name),
    isActive: Number(r.is_active ?? 0) === 1,
  };
}

/**
 * Looks a user up by name. Returns inactive users too — the caller decides how to
 * treat them, so that "account disabled" and "no such user" stay distinguishable
 * internally while presenting one message to the user.
 */
export async function findUserByUsername(username: string): Promise<UserRow | null> {
  return withDb("findUserByUsername", async (db) => {
    const rows = (await db.execute(
      "SELECT * FROM users WHERE username = ? LIMIT 1;", [username])).rows ?? [];
    return rows.length === 0 ? null : toUser(rows[0]);
  });
}

export async function findUserById(id: number): Promise<UserRow | null> {
  return withDb("findUserById", async (db) => {
    const rows = (await db.execute("SELECT * FROM users WHERE id = ? LIMIT 1;", [id])).rows ?? [];
    return rows.length === 0 ? null : toUser(rows[0]);
  });
}

export async function listRolesForUser(userId: number): Promise<RoleCode[]> {
  return withDb("listRolesForUser", async (db) => {
    const rows = (await db.execute(
      `SELECT r.code FROM user_roles ur
         JOIN roles r ON r.code = ur.role_code
        WHERE ur.user_id = ?
        ORDER BY r.sort_order, r.code;`,
      [userId],
    )).rows ?? [];
    return rows.map((r) => String(r.code) as RoleCode);
  });
}

export async function listRoles(): Promise<RoleRow[]> {
  return withDb("listRoles", async (db) => {
    const rows = (await db.execute("SELECT code, label FROM roles ORDER BY sort_order, code;")).rows ?? [];
    return rows.map((r) => ({ code: String(r.code) as RoleCode, label: String(r.label) }));
  });
}

/**
 * The party and entity this user should see in the given role.
 *
 * Returns null when no profile is linked. It deliberately does NOT fall back to
 * the first row of the domain table, which is what it used to do: that made an
 * unlinked account silently resolve to farmer MH-AH-2024-00831 / fpo-1 / b-1.
 * Harmless while every screen was read-only, but the moment writes carry an
 * author it becomes one account writing as another organisation. A missing
 * profile is now a sign-in failure (authService's `no_profile`), which is
 * recoverable by linking the profile — a silent cross-tenant write is not.
 */
export async function getProfile(userId: number, role: ViewRole): Promise<ProfileRef | null> {
  // Admin has no entity of its own: an administrator acts as themselves, so the
  // session carries no party and every admin action is gated on the role instead
  // of on a profile.
  if (role === "admin") return { partyId: 0, entityId: "" };
  return withDb("getProfile", async (db) => {
    const rows = (await db.execute(
      `SELECT p.id AS party_id, p.entity_id AS entity_id
         FROM user_profiles up
         JOIN parties p ON p.id = up.party_id
        WHERE up.user_id = ? AND up.role_code = ? AND p.kind = ? AND p.is_active = 1
        LIMIT 1;`,
      [userId, role, PARTY_KIND[role]],
    )).rows ?? [];
    if (rows.length === 0) return null;
    return { partyId: Number(rows[0].party_id), entityId: String(rows[0].entity_id) };
  });
}

/* ------------------------------------------------------------------ writes */
/* Used by seeding today, and by any future admin/user-management screen. */

export async function createUser(
  username: string, passwordHash: string, displayName: string,
): Promise<number> {
  return withWrite("createUser", async (db) => {
    await db.execute(
      "INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?);",
      [username, passwordHash, displayName],
    );
    const rows = (await db.execute("SELECT id FROM users WHERE username = ?;", [username])).rows ?? [];
    return Number(rows[0].id);
  });
}

export async function assignRole(userId: number, role: RoleCode): Promise<void> {
  await withWrite("assignRole", (db) => db.execute(
    "INSERT OR IGNORE INTO user_roles (user_id, role_code) VALUES (?, ?);", [userId, role],
  ));
}

/**
 * Links a login to an entity for one role. The entity id is resolved to its party
 * inside the same statement, so a caller can never store a party id belonging to
 * the wrong kind.
 */
export async function linkProfile(userId: number, role: ViewRole, entityId: string): Promise<void> {
  await withWrite("linkProfile", (db) => db.execute(
    `INSERT OR REPLACE INTO user_profiles (user_id, role_code, party_id)
       SELECT ?, ?, p.id FROM parties p WHERE p.kind = ? AND p.entity_id = ?;`,
    [userId, role, PARTY_KIND[role], entityId],
  ));
}

export async function countUsers(): Promise<number> {
  return withDb("countUsers", async (db) => {
    const rows = (await db.execute("SELECT COUNT(*) AS n FROM users;")).rows ?? [];
    return Number(rows[0]?.n ?? 0);
  });
}
