/**
 * Migration 005 — connections, conversations, notifications.
 *
 * Phase 3 gave one party a way to answer another party's posting. This gives them
 * a way to be connected outside any single posting, to talk, and to find out that
 * something happened to them.
 *
 * On the pair-uniqueness index: the plan called for SQLite generated columns
 * (`GENERATED ALWAYS AS (MIN(...))`), which need SQLite >= 3.31 — a version this
 * app cannot check at build time across both platforms and the bundled op-sqlite.
 * `pair_lo`/`pair_hi` are ordinary columns the repository writes in sorted order
 * instead, with `CHECK (pair_lo < pair_hi)` so the database still refuses a row
 * that got the ordering wrong. Same guarantee, no version dependency.
 *
 * `conversations` carries one nullable foreign key per context it can attach to.
 * Only `connection_id` and `request_id` exist here because orders and memberships
 * are later phases; those columns are added by ALTER TABLE when their tables
 * arrive, which SQLite allows for a nullable column with a REFERENCES clause.
 */
export const MIGRATION_005: string[] = [
  /* --------------------------------------------------------- connections -- */
  `CREATE TABLE IF NOT EXISTS connections (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    addressee_party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    -- The same two ids in ascending order. Written by the repository; the CHECK
    -- below is what stops an unsorted pair sneaking past the unique index.
    pair_lo            INTEGER NOT NULL,
    pair_hi            INTEGER NOT NULL,
    relation_type      TEXT NOT NULL CHECK (relation_type IN
                         ('trade','supply','peer','advisory','service')),
    origin_request_id  INTEGER REFERENCES requests(id) ON DELETE SET NULL,
    status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                         ('pending','accepted','rejected','blocked','withdrawn')),
    message            TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at         TEXT,
    decided_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CHECK (requester_party_id <> addressee_party_id),
    CHECK (pair_lo < pair_hi)
  );`,

  // One connection per pair per relation. Without this, A requesting B and B
  // requesting A would both sit pending and each side would see a stranger.
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_connections_pair
     ON connections(pair_lo, pair_hi, relation_type);`,
  `CREATE INDEX IF NOT EXISTS idx_connections_requester ON connections(requester_party_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_connections_addressee ON connections(addressee_party_id, status);`,

  /* ------------------------------------------------------- conversations -- */
  `CREATE TABLE IF NOT EXISTS conversations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    subject       TEXT,
    connection_id INTEGER REFERENCES connections(id) ON DELETE CASCADE,
    request_id    INTEGER REFERENCES requests(id)    ON DELETE CASCADE,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    -- At most one context. A thread hanging off two things would have two
    -- different answers to "who is allowed to read this".
    CHECK ((connection_id IS NOT NULL) + (request_id IS NOT NULL) <= 1)
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS ux_conversations_connection
     ON conversations(connection_id) WHERE connection_id IS NOT NULL;`,

  `CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    party_id        INTEGER NOT NULL REFERENCES parties(id)       ON DELETE CASCADE,
    last_read_at    TEXT,
    PRIMARY KEY (conversation_id, party_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_convo_participant ON conversation_participants(party_id);`,

  `CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_party_id INTEGER NOT NULL REFERENCES parties(id)       ON DELETE CASCADE,
    body            TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(conversation_id, created_at);`,

  /* ------------------------------------------------------- notifications -- */
  // What tells the other persona that something happened to them. Nullable FKs
  // per context rather than a (type, id) pair, so a deleted request takes its
  // notifications with it instead of leaving rows pointing at nothing.
  `CREATE TABLE IF NOT EXISTS notifications (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    actor_party_id     INTEGER REFERENCES parties(id) ON DELETE SET NULL,
    type               TEXT NOT NULL,
    title              TEXT NOT NULL,
    body               TEXT,
    connection_id      INTEGER REFERENCES connections(id)       ON DELETE CASCADE,
    request_id         INTEGER REFERENCES requests(id)          ON DELETE CASCADE,
    response_id        INTEGER REFERENCES request_responses(id) ON DELETE CASCADE,
    conversation_id    INTEGER REFERENCES conversations(id)     ON DELETE CASCADE,
    is_read            INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE INDEX IF NOT EXISTS idx_notifications_box
     ON notifications(recipient_party_id, is_read, created_at DESC);`,
];
