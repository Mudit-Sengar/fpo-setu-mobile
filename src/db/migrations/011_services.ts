/**
 * Migration 011 — service requests and the audit trail.
 *
 * The last three simulated actions in the app are here: applying for credit,
 * requesting a compliance service, and asking for a contract template. All three
 * showed a success toast and wrote nothing, and the lenders, auditors and
 * advisors on the other side had no inbox to receive them in — they were rows in
 * five ID-less directories until migration 003 gave them a party.
 *
 * `audit_events` is the other half of Phase 8: once an admin can disable an
 * account or deactivate a party, and once one persona's decision changes another
 * persona's standing, there has to be a record of who did it. Written by the
 * decision points that change somebody else's position, not by every write —
 * an audit log nobody can read through is the same as no audit log.
 */
export const MIGRATION_011: string[] = [
  `CREATE TABLE IF NOT EXISTS service_requests (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    provider_party_id  INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    service_type       TEXT NOT NULL CHECK (service_type IN
                         ('credit','compliance','logistics','advisory','contract')),
    subject            TEXT NOT NULL,
    details            TEXT,
    amount_requested   REAL,
    status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                         ('pending','in_review','approved','rejected','completed','withdrawn')),
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at         TEXT,
    decided_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CHECK (requester_party_id <> provider_party_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_service_req_provider
     ON service_requests(provider_party_id, status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_service_req_requester
     ON service_requests(requester_party_id, status, created_at DESC);`,

  // A service request can carry a conversation, the same way a connection does.
  `ALTER TABLE conversations ADD COLUMN service_request_id INTEGER REFERENCES service_requests(id) ON DELETE CASCADE;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_conversations_service
     ON conversations(service_request_id) WHERE service_request_id IS NOT NULL;`,

  `ALTER TABLE notifications ADD COLUMN service_request_id INTEGER REFERENCES service_requests(id) ON DELETE CASCADE;`,

  /* ------------------------------------------------------------ audit ----- */
  // `entity_type` + `entity_id` rather than a nullable FK per table: this is a
  // log, and it must survive the row it describes being deleted. That is the one
  // place in this schema where a soft pointer is the right answer.
  `CREATE TABLE IF NOT EXISTS audit_events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id  INTEGER REFERENCES users(id)   ON DELETE SET NULL,
    actor_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
    action         TEXT NOT NULL,
    entity_type    TEXT NOT NULL,
    entity_id      TEXT NOT NULL,
    from_status    TEXT,
    to_status      TEXT,
    detail         TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE INDEX IF NOT EXISTS idx_audit_recent ON audit_events(created_at DESC, id DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);`,
  `CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_events(actor_user_id, created_at DESC);`,
];
