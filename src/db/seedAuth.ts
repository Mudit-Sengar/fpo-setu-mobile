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
  { code: "buyer", label: "Buyer / Seller", sort: 3 },
  { code: "admin", label: "Admin", sort: 4 },
];

/**
 * Initial accounts. `profiles` links each account to its own domain record, so
 * every role has a separate profile even though they share one login table.
 *
 * The admin is linked to all three so switching views loads a real profile rather
 * than falling back to whatever row happens to sort first.
 */
const ACCOUNTS: {
  username: string;
  password: string;
  displayName: string;
  roles: string[];
  profiles: { role: "farmer" | "fpo" | "buyer"; id: string }[];
}[] = [
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
    username: "admin01", password: "admin", displayName: "System Administrator",
    roles: ["admin"],
    profiles: [
      { role: "farmer", id: "MH-AH-2024-00831" },
      { role: "fpo", id: "fpo-1" },
      { role: "buyer", id: "b-1" },
    ],
  },
];

const PROFILE_TABLE = {
  farmer: { table: "farmer_profiles", column: "farmer_id" },
  fpo: { table: "fpo_profiles", column: "fpo_id" },
  buyer: { table: "buyer_profiles", column: "buyer_id" },
} as const;

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
        const { table, column } = PROFILE_TABLE[p.role];
        // Skip a link whose domain row is missing rather than aborting the whole
        // seed on a foreign-key error.
        const exists = await tx.execute(
          `SELECT 1 AS ok FROM ${p.role === "fpo" ? "fpos" : p.role === "buyer" ? "buyers" : "farmers"} WHERE id = ?;`,
          [p.id],
        );
        if ((exists.rows?.length ?? 0) === 0) continue;
        await tx.execute(
          `INSERT OR REPLACE INTO ${table} (user_id, ${column}) VALUES (?, ?);`, [userId, p.id],
        );
      }
    }
  });
}
