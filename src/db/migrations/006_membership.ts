/**
 * Migration 006 — membership.
 *
 * Belonging to an FPO was `farmers.fpo_id`: one nullable column, no application,
 * no approval, no history. A farmer tapping "Apply for Membership" filled in a
 * form that was thrown away, and the FPO had nowhere to see it. Membership is a
 * relationship with a lifecycle, so it becomes a row with a status.
 *
 * `member_engagement` — the parallel roster keyed by name text, where the same
 * "Suresh Patil" existed twice with no link between them — is superseded by the
 * `v_member_engagement` view, which derives everything from real transactions and
 * trainings. The table is left in place as the recovery path for the
 * reconciliation in src/db/membershipBackfill.ts.
 */
export const MIGRATION_006: string[] = [
  `CREATE TABLE IF NOT EXISTS memberships (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id          TEXT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    fpo_id             TEXT NOT NULL REFERENCES fpos(id)    ON DELETE CASCADE,
    status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                         ('pending','active','rejected','suspended','exited')),
    share_pct          REAL NOT NULL DEFAULT 0 CHECK (share_pct >= 0),
    application_note   TEXT,
    -- Contact details given on the application form. Kept on the membership
    -- rather than overwritten onto the farmer, because an applicant may state a
    -- number for this FPO to reach them on without changing their profile.
    contact_phone      TEXT,
    applied_at         TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at         TEXT,
    joined_at          TEXT,
    exited_at          TEXT,
    decided_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    -- Where a backfilled row came from ('farmers.fpo_id:MH-AH-1'). Makes the
    -- reconciliation idempotent and keeps its decisions auditable.
    source_ref         TEXT UNIQUE
  );`,

  // A farmer may apply to several FPOs but belong to exactly one. Partial unique
  // indexes express that without blocking the application history: rejected and
  // exited rows stay, and only 'active' is constrained.
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_membership_one_active
     ON memberships(farmer_id) WHERE status = 'active';`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_membership_one_pending
     ON memberships(farmer_id, fpo_id) WHERE status = 'pending';`,
  `CREATE INDEX IF NOT EXISTS idx_memberships_fpo    ON memberships(fpo_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_memberships_farmer ON memberships(farmer_id, status);`,

  `CREATE TABLE IF NOT EXISTS member_trainings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    membership_id INTEGER NOT NULL REFERENCES memberships(id)  ON DELETE CASCADE,
    meeting_id    INTEGER REFERENCES fpo_meetings(id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    completed_at  TEXT NOT NULL DEFAULT (datetime('now')),
    source_ref    TEXT UNIQUE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_member_trainings ON member_trainings(membership_id);`,

  // "Send notification to all members" reported a count without writing anything.
  // One row per invited member makes the count the number of rows actually sent.
  `CREATE TABLE IF NOT EXISTS meeting_invitations (
    meeting_id    INTEGER NOT NULL REFERENCES fpo_meetings(id) ON DELETE CASCADE,
    membership_id INTEGER NOT NULL REFERENCES memberships(id)  ON DELETE CASCADE,
    notified_at   TEXT NOT NULL DEFAULT (datetime('now')),
    response      TEXT NOT NULL DEFAULT 'invited' CHECK (response IN
                    ('invited','accepted','declined','attended','absent')),
    PRIMARY KEY (meeting_id, membership_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_meeting_invitations_member ON meeting_invitations(membership_id);`,

  // Lets an FPO's outreach to a member hang off the membership.
  //
  // NOTE: migration 005 gave `conversations` a CHECK that at most one of
  // (connection_id, request_id) is set. SQLite cannot extend a CHECK without
  // rebuilding the table, and rebuilding would cascade-delete every message and
  // participant row. So this column sits outside that constraint and exclusivity
  // is enforced by networkRepository, which is the only writer. The partial
  // unique index below still guarantees one thread per membership.
  `ALTER TABLE conversations ADD COLUMN membership_id INTEGER REFERENCES memberships(id) ON DELETE CASCADE;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_conversations_membership
     ON conversations(membership_id) WHERE membership_id IS NOT NULL;`,

  /* ---------------------------------------------------------- engagement -- */
  // Replaces the frozen roster. Sold volume and last-transaction date come from
  // `farmer_txns`, training count from `member_trainings`, and the status is a
  // rule over them rather than a stored word that could never change.
  //
  // Thresholds are seasonal, not arbitrary: Indian cropping runs kharif then
  // rabi, roughly 120 days each. A member who has not sold through the FPO for a
  // full season is at risk; two seasons and they are dormant in practice.
  `CREATE VIEW IF NOT EXISTS v_member_engagement AS
     SELECT m.id            AS membership_id,
            m.fpo_id        AS fpo_id,
            f.id            AS farmer_id,
            f.name          AS name,
            f.village       AS village,
            COALESCE(SUM(t.qty_q), 0) AS sold_through_fpo,
            (SELECT COUNT(*) FROM member_trainings mt WHERE mt.membership_id = m.id) AS trainings,
            MAX(t.date)     AS last_txn,
            CASE
              WHEN MAX(t.date) IS NULL                        THEN 'Dormant'
              WHEN MAX(t.date) >= date('now','-120 days')     THEN 'Active'
              WHEN MAX(t.date) >= date('now','-240 days')     THEN 'At-risk'
              ELSE 'Dormant'
            END             AS status
       FROM memberships m
       JOIN farmers f ON f.id = m.farmer_id
       LEFT JOIN farmer_txns t ON t.farmer_id = m.farmer_id
      WHERE m.status = 'active'
      GROUP BY m.id, m.fpo_id, f.id, f.name, f.village;`,
];
