/**
 * Authentication & identity schema.
 *
 * Deliberately separate from the domain tables in 001: `farmers`, `fpos` and
 * `buyers` describe *organisations and people in the market*, while `users`
 * describes *who can sign in*. The `*_profiles` join tables are the link between
 * the two, which is what lets one login own exactly one profile per role without
 * either table having to know about the other.
 *
 * Roles live in a table rather than a CHECK constraint so a role can be added by
 * inserting a row — the requirement is that users and their roles are editable in
 * the database with no application-code change.
 */
export const MIGRATION_002 = `
-- Available roles. 'admin' is not a view of its own: it grants the holder the
-- right to open any of the other three (see auth service resolveViewableRoles).
CREATE TABLE IF NOT EXISTS roles (
  code       TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Many-to-many: a user may hold several roles (and an admin effectively holds all).
CREATE TABLE IF NOT EXISTS user_roles (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code TEXT    NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_code)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

-- One profile row per (user, role). PRIMARY KEY on user_id enforces "at most one
-- farmer profile per login"; the FK to the domain table keeps the link honest.
CREATE TABLE IF NOT EXISTS farmer_profiles (
  user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  farmer_id TEXT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fpo_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  fpo_id  TEXT NOT NULL REFERENCES fpos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS buyer_profiles (
  user_id  INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE
);
`;
