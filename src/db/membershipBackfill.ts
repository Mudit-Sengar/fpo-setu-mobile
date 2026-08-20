import type { DB } from "@op-engineering/op-sqlite";

/**
 * Turns the two pre-006 sources of "who belongs to this FPO" into `memberships`.
 *
 * There were two, and they disagreed:
 *
 *  1. `farmers.fpo_id` — a real foreign key, but only for the three seeded
 *     farmers, with no status and no history.
 *  2. `member_engagement` — a 16-row roster of names and villages with no link to
 *     `farmers` at all. "Suresh Patil" appeared in both, as two unrelated records.
 *
 * Matching those two together is the risky part of this phase, so the rules are
 * deliberately conservative:
 *
 *  - A roster row matches a farmer only on name AND village. Name alone would
 *    merge two different people — the seed already contains a "Suresh Patil" and
 *    a "Suresh Kale" in different villages, and real rosters repeat names
 *    constantly.
 *  - An ambiguous match (more than one farmer with that name and village) is
 *    treated as no match, because guessing which one would silently attribute a
 *    stranger's payment history to somebody.
 *  - An unmatched roster row becomes a NEW farmer rather than being dropped. The
 *    FPO's member list is the thing being migrated; losing rows from it would be
 *    the worst possible outcome.
 *
 * Every row written records where it came from in `source_ref`, which makes this
 * idempotent and lets a human check any individual decision afterwards.
 *
 * The frozen `sold_through_fpo` / `trainings` figures are relocated rather than
 * discarded: one transaction row and N training rows per member, so that
 * `v_member_engagement` derives the numbers the screen already showed. They are
 * migrated placeholders, not invented data — the values were already there.
 */

const str = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));
const num = (v: unknown): number => Number(v ?? 0);

interface Row { [k: string]: unknown }

/** Farmer id for a roster row, or null when the match is absent or ambiguous. */
async function matchFarmer(db: DB, name: string, village: string): Promise<string | null> {
  if (name === "" || village === "") return null;
  const rows = (await db.execute(
    "SELECT id FROM farmers WHERE name = ? AND village = ?;", [name, village])).rows ?? [];
  // Exactly one, or nothing. Two people with the same name in the same village is
  // possible in reality, and picking either would be a guess.
  return rows.length === 1 ? String(rows[0].id) : null;
}

export async function backfillMemberships(db: DB): Promise<void> {
  /* ------------------------------- 1. farmers.fpo_id -> active membership -- */
  const linked = (await db.execute(
    `SELECT id, fpo_id, share_pct, member_since FROM farmers
      WHERE fpo_id IS NOT NULL AND fpo_id <> '';`)).rows ?? [];

  for (const f of linked as Row[]) {
    const farmerId = str(f.id);
    await db.execute(
      `INSERT OR IGNORE INTO memberships
         (farmer_id, fpo_id, status, share_pct, applied_at, joined_at, decided_at, source_ref)
       VALUES (?, ?, 'active', ?, ?, ?, ?, ?);`,
      [farmerId, str(f.fpo_id), num(f.share_pct),
        str(f.member_since, "") || null, str(f.member_since, "") || null,
        str(f.member_since, "") || null, `farmers.fpo_id:${farmerId}`],
    );
  }

  /* ------------------------ 2. member_engagement -> farmers + memberships -- */
  const roster = (await db.execute(
    `SELECT id, fpo_id, name, village, status, sold_through_fpo, trainings, last_txn
       FROM member_engagement;`)).rows ?? [];

  for (const r of roster as Row[]) {
    const rosterId = str(r.id);
    const fpoId = str(r.fpo_id);
    const name = str(r.name);
    const village = str(r.village);
    if (fpoId === "" || name === "") continue;

    const sourceRef = `member_engagement:${rosterId}`;

    // Already reconciled on a previous launch.
    const done = (await db.execute(
      "SELECT id FROM memberships WHERE source_ref = ?;", [sourceRef])).rows ?? [];
    if (done.length > 0) continue;

    let farmerId = await matchFarmer(db, name, village);
    let membershipId: number | null = null;

    if (farmerId == null) {
      // No confident match: this roster row describes somebody the app does not
      // otherwise know about. Give them a farmer record of their own, keyed on
      // the roster row so a re-run finds them instead of creating a duplicate.
      farmerId = `me-${rosterId}`;
      await db.execute(
        `INSERT OR IGNORE INTO farmers (id, name, village, district, state, fpo_id)
           SELECT ?, ?, ?, o.district, 'Maharashtra', ? FROM fpos o WHERE o.id = ?;`,
        [farmerId, name, village, fpoId, fpoId]);
    } else {
      // Matched an existing farmer. If they are already an active member of this
      // FPO from step 1, reuse that membership rather than opening a second one —
      // the one-active-membership index would reject it anyway.
      const existing = (await db.execute(
        "SELECT id FROM memberships WHERE farmer_id = ? AND status = 'active';", [farmerId])).rows ?? [];
      if (existing.length > 0) membershipId = Number(existing[0].id);
    }

    if (membershipId == null) {
      await db.execute(
        `INSERT OR IGNORE INTO memberships
           (farmer_id, fpo_id, status, applied_at, joined_at, decided_at, source_ref)
         VALUES (?, ?, 'active', ?, ?, ?, ?);`,
        [farmerId, fpoId, str(r.last_txn, "") || null, str(r.last_txn, "") || null,
          str(r.last_txn, "") || null, sourceRef]);
      const created = (await db.execute(
        "SELECT id FROM memberships WHERE source_ref = ?;", [sourceRef])).rows ?? [];
      if (created.length === 0) continue;
      membershipId = Number(created[0].id);
    }
    // A roster row that merged into an existing membership needs no marker of its
    // own: the membership keeps the source_ref from step 1, and everything this
    // loop writes below is keyed on `sourceRef` too, so a re-run no-ops on each.
    // An earlier version wrote a "Roster reconciled" row into member_trainings to
    // mark the merge, which then counted as a training the member had attended.

    /* ------- relocate the frozen figures so the derived view reproduces them */
    const sold = num(r.sold_through_fpo);
    const lastTxn = str(r.last_txn);
    if (sold > 0 && lastTxn !== "") {
      // One transaction standing in for a season of sales. Only written where the
      // farmer has no transaction history of their own — the three seeded farmers
      // have real rows and must not be topped up with a synthetic one.
      const hasTxns = (await db.execute(
        "SELECT 1 AS ok FROM farmer_txns WHERE farmer_id = ? LIMIT 1;", [farmerId])).rows ?? [];
      if (hasTxns.length === 0) {
        await db.execute(
          `INSERT INTO farmer_txns (farmer_id, date, crop, qty_q, price, amount, ref_id)
           VALUES (?, ?, '', ?, 0, 0, ?);`,
          [farmerId, lastTxn, sold, `MIGRATED-${sourceRef}`]);
      }
    }

    const trainings = num(r.trainings);
    for (let i = 0; i < trainings; i++) {
      await db.execute(
        `INSERT OR IGNORE INTO member_trainings (membership_id, title, completed_at, source_ref)
         VALUES (?, ?, ?, ?);`,
        [membershipId, "FPO training", str(r.last_txn, "") || null, `${sourceRef}:${i}`]);
    }
  }
}
