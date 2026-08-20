import type { DB } from "@op-engineering/op-sqlite";
import { hashPassword } from "../lib/crypto/password";

/**
 * First-run seeding of roles and the initial accounts.
 *
 * These are ordinary rows: once written they are read by the same queries as any
 * user added later, and nothing in the app refers to them by name. Adding,
 * editing or removing a user afterwards is purely a database operation.
 *
 * Passwords are hashed here and never stored in plaintext — the constants below
 * are the initial credentials being *handed to* the hasher, which is the only
 * place they exist.
 */

const ROLES: { code: string; label: string; sort: number }[] = [
  { code: "farmer", label: "Farmer", sort: 1 },
  { code: "fpo", label: "FPO", sort: 2 },
  { code: "buyer", label: "Buyer", sort: 3 },
  { code: "supplier", label: "Supplier", sort: 4 },
  { code: "admin", label: "Admin", sort: 5 },
];

type ProfileRole = "farmer" | "fpo" | "buyer" | "supplier";

interface Account {
  username: string;
  password: string;
  displayName: string;
  roles: string[];
  profiles: { role: ProfileRole; id: string }[];
}

/**
 * Initial accounts. `profiles` links each account to its own domain record, so
 * every role has a separate profile even though they share one login table.
 *
 * The admin is linked to all four so switching views loads a real profile — with
 * the first-row fallback gone from authRepository, an unlinked role now fails to
 * open at all rather than silently borrowing someone else's organisation.
 */
const ACCOUNTS: Account[] = [
  {
    username: "farmer01", password: "farmer", displayName: "Suresh Patil",
    roles: ["farmer"],
    profiles: [{ role: "farmer", id: "MH-AH-2024-00831" }],
  },
  {
    username: "fpo01", password: "fpo", displayName: "Samruddha Adivasi Agro",
    roles: ["fpo"],
    profiles: [{ role: "fpo", id: "fpo-1" }],
  },
  {
    username: "buyer01", password: "buyer", displayName: "Sahyadri Foods Pvt Ltd",
    roles: ["buyer"],
    profiles: [{ role: "buyer", id: "b-1" }],
  },
  {
    username: "supplier01", password: "supplier", displayName: "Mahabeej Seeds Ltd",
    roles: ["supplier"],
    profiles: [{ role: "supplier", id: "s-1" }],
  },
  {
    username: "admin01", password: "admin", displayName: "System Administrator",
    roles: ["admin"],
    profiles: [
      { role: "farmer", id: "MH-AH-2024-00831" },
      { role: "fpo", id: "fpo-1" },
      { role: "buyer", id: "b-1" },
      { role: "supplier", id: "s-1" },
    ],
  },
];

/**
 * Writes one profile link, resolving the entity id to its party inside the
 * statement. Skips silently when the party row is missing rather than aborting
 * the whole seed on a foreign-key error.
 */
async function linkProfile(
  tx: { execute: (sql: string, params?: (string | number | null)[]) => Promise<unknown> },
  userId: number, role: ProfileRole, entityId: string,
): Promise<void> {
  await tx.execute(
    `INSERT OR IGNORE INTO user_profiles (user_id, role_code, party_id)
       SELECT ?, ?, p.id FROM parties p WHERE p.kind = ? AND p.entity_id = ?;`,
    [userId, role, role, entityId],
  );
}

/**
 * Seeds roles and accounts if the `users` table is empty.
 *
 * Guarded separately from the domain seed in seed.ts: that one is keyed on `fpos`
 * being empty, and an existing install already has rows there. Without its own
 * guard the auth tables would stay empty on upgrade and nobody could log in.
 */
export async function seedAuthIfEmpty(db: DB): Promise<void> {
  const existing = await db.execute("SELECT COUNT(*) AS n FROM users;");
  if (Number(existing.rows?.[0]?.n ?? 0) > 0) return;

  // Hashing is CPU-bound (PBKDF2); do it before opening the transaction so the
  // write lock is held for as short a time as possible.
  const prepared = ACCOUNTS.map((a) => ({ ...a, hash: hashPassword(a.password) }));

  await db.transaction(async (tx) => {
    for (const r of ROLES) {
      await tx.execute(
        "INSERT OR IGNORE INTO roles (code, label, sort_order) VALUES (?, ?, ?);",
        [r.code, r.label, r.sort],
      );
    }

    for (const a of prepared) {
      await tx.execute(
        "INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?);",
        [a.username, a.hash, a.displayName],
      );
      const idRow = await tx.execute("SELECT id FROM users WHERE username = ?;", [a.username]);
      const userId = Number(idRow.rows?.[0]?.id);

      for (const role of a.roles) {
        await tx.execute(
          "INSERT OR IGNORE INTO user_roles (user_id, role_code) VALUES (?, ?);", [userId, role],
        );
      }

      for (const p of a.profiles) {
        await linkProfile(tx, userId, p.role, p.id);
      }
    }
  });
}

/**
 * Brings an EXISTING install up to date with the supplier role.
 *
 * seedAuthIfEmpty is guarded on `users` being empty, so an install that predates
 * the supplier role would never receive the supplier01 account, and its admin
 * would have no supplier profile to switch into. This runs on every launch and
 * is idempotent: it only writes what is missing.
 */
export async function ensureSupplierAccess(db: DB): Promise<void> {
  const supplierAccount = ACCOUNTS.find((a) => a.username === "supplier01");
  if (supplierAccount == null) return;

  // Nothing to link to on a database whose suppliers were never seeded.
  const hasParty = await db.execute(
    "SELECT 1 AS ok FROM parties WHERE kind = 'supplier' LIMIT 1;");
  if ((hasParty.rows?.length ?? 0) === 0) return;

  const existing = await db.execute(
    "SELECT id FROM users WHERE username = ?;", [supplierAccount.username]);
  const needsAccount = (existing.rows?.length ?? 0) === 0;

  // Only pay for PBKDF2 when the account actually has to be created.
  const hash = needsAccount ? hashPassword(supplierAccount.password) : null;

  await db.transaction(async (tx) => {
    if (needsAccount && hash != null) {
      await tx.execute(
        "INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?);",
        [supplierAccount.username, hash, supplierAccount.displayName],
      );
      const idRow = await tx.execute(
        "SELECT id FROM users WHERE username = ?;", [supplierAccount.username]);
      const userId = Number(idRow.rows?.[0]?.id);
      await tx.execute(
        "INSERT OR IGNORE INTO user_roles (user_id, role_code) VALUES (?, 'supplier');", [userId]);
      for (const p of supplierAccount.profiles) {
        await linkProfile(tx, userId, p.role, p.id);
      }
    }

    // Every admin can open every view, so an admin without a supplier profile
    // would hit `no_profile` on switching. Linked by role, not by username, so a
    // second admin added later is covered too.
    await tx.execute(
      `INSERT OR IGNORE INTO user_profiles (user_id, role_code, party_id)
         SELECT ur.user_id, 'supplier', p.id
           FROM user_roles ur
           JOIN parties p ON p.kind = 'supplier' AND p.entity_id = ?
          WHERE ur.role_code = 'admin';`,
      ["s-1"],
    );
  });
}
