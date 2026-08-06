import { withDb } from "../connection";

/**
 * All SQL for identity: users, roles, role assignments and the per-role profile
 * links. Screens never see any of this — they go through src/services/authService,
 * which is what keeps a future swap to a remote backend a one-file change.
 */

/** A role a user can hold. `admin` grants access to the other three. */
export type RoleCode = "farmer" | "fpo" | "buyer" | "admin";

/** The three roles that correspond to an actual app view. */
export type ViewRole = Exclude<RoleCode, "admin">;

export const VIEW_ROLES: ViewRole[] = ["farmer", "fpo", "buyer"];

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

/** Which table holds the profile link for each view role. */
const PROFILE_TABLE: Record<ViewRole, { table: string; column: string; domain: string }> = {
  farmer: { table: "farmer_profiles", column: "farmer_id", domain: "farmers" },
  fpo: { table: "fpo_profiles", column: "fpo_id", domain: "fpos" },
  buyer: { table: "buyer_profiles", column: "buyer_id", domain: "buyers" },
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
    // COLLATE NOCASE on the column makes this case-insensitive, so `Farmer01`
    // and `farmer01` are the same login.
    const rows = (await db.execute(
      "SELECT * FROM users WHERE username = ? LIMIT 1;", [username.trim()],
    )).rows ?? [];
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
 * The domain record id this user should see in the given role — `farmers.id`,
 * `fpos.id` or `buyers.id`.
 *
 * Falls back to the first row of the domain table when the user has no explicit
 * link, so a newly added database user without a profile row still lands on a
 * working screen instead of an empty one. Returns null only when the domain table
 * itself is empty.
 */
export async function getProfileId(userId: number, role: ViewRole): Promise<string | null> {
  const { table, column, domain } = PROFILE_TABLE[role];
  return withDb("getProfileId", async (db) => {
    const linked = (await db.execute(
      `SELECT ${column} AS pid FROM ${table} WHERE user_id = ? LIMIT 1;`, [userId],
    )).rows ?? [];
    if (linked.length > 0) return String(linked[0].pid);

    const fallback = (await db.execute(`SELECT id FROM ${domain} ORDER BY id LIMIT 1;`)).rows ?? [];
    return fallback.length === 0 ? null : String(fallback[0].id);
  });
}

/* ------------------------------------------------------------------ writes */
/* Used by seeding today, and by any future admin/user-management screen. */

export async function createUser(
  username: string, passwordHash: string, displayName: string,
): Promise<number> {
  return withDb("createUser", async (db) => {
    await db.execute(
      "INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?);",
      [username, passwordHash, displayName],
    );
    const rows = (await db.execute("SELECT id FROM users WHERE username = ?;", [username])).rows ?? [];
    return Number(rows[0].id);
  });
}

export async function assignRole(userId: number, role: RoleCode): Promise<void> {
  await withDb("assignRole", (db) => db.execute(
    "INSERT OR IGNORE INTO user_roles (user_id, role_code) VALUES (?, ?);", [userId, role],
  ));
}

export async function linkProfile(userId: number, role: ViewRole, profileId: string): Promise<void> {
  const { table, column } = PROFILE_TABLE[role];
  await withDb("linkProfile", (db) => db.execute(
    `INSERT OR REPLACE INTO ${table} (user_id, ${column}) VALUES (?, ?);`, [userId, profileId],
  ));
}

export async function countUsers(): Promise<number> {
  return withDb("countUsers", async (db) => {
    const rows = (await db.execute("SELECT COUNT(*) AS n FROM users;")).rows ?? [];
    return Number(rows[0]?.n ?? 0);
  });
}
