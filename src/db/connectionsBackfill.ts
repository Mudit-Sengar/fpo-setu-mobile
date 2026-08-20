import type { DB } from "@op-engineering/op-sqlite";

/**
 * Seeds the party-to-party `connections` graph (and a starter thread for each)
 * from relationships that already exist elsewhere in the data — an active
 * membership, a review, a shared FPO roster — rather than inventing new pairs.
 *
 * Before this, `connections` was written only by the app itself (tapping
 * "Connect" on a matching screen), so every Connect/Messages screen opened empty
 * on a fresh install even though the farmers, FPOs, buyers and suppliers behind
 * them had real trading history. Idempotent via the same
 * (pair_lo, pair_hi, relation_type) uniqueness `requestConnection` relies on —
 * `INSERT OR IGNORE` is enough here since every pair below is inserted at most
 * once per run.
 */

interface Row { [k: string]: unknown }

/** The slice of the driver these helpers need — satisfied by both `DB` and the
 * `Transaction` object passed to `db.transaction`. */
type Bindable = string | number | boolean | null;
interface DbLike {
  execute: (sql: string, params?: Bindable[]) => Promise<{ rows?: Record<string, unknown>[] }>;
}

const STARTERS = [
  "Good to connect — let's talk about this season's supply.",
  "Looking forward to working together.",
  "Happy to share details whenever you need them.",
];

async function ensureThread(
  db: DbLike, connectionId: number, a: number, b: number, starter: string,
): Promise<void> {
  await db.execute("INSERT OR IGNORE INTO conversations (connection_id) VALUES (?);", [connectionId]);
  const rows = (await db.execute(
    "SELECT id FROM conversations WHERE connection_id = ?;", [connectionId])).rows ?? [];
  if (rows.length === 0) return;
  const conversationId = Number(rows[0].id);
  await db.execute(
    "INSERT OR IGNORE INTO conversation_participants (conversation_id, party_id) VALUES (?,?);",
    [conversationId, a]);
  await db.execute(
    "INSERT OR IGNORE INTO conversation_participants (conversation_id, party_id) VALUES (?,?);",
    [conversationId, b]);
  const existing = (await db.execute(
    "SELECT 1 AS ok FROM messages WHERE conversation_id = ? LIMIT 1;", [conversationId])).rows ?? [];
  if (existing.length === 0) {
    await db.execute(
      "INSERT INTO messages (conversation_id, sender_party_id, body) VALUES (?,?,?);",
      [conversationId, a, starter]);
  }
}

/** Creates an accepted connection between two parties, with a starter thread. */
async function connect(
  db: DbLike, a: number, b: number, relationType: string, starterIdx: number,
): Promise<void> {
  if (a === b) return;
  const [lo, hi] = a < b ? [a, b] : [b, a];
  await db.execute(
    `INSERT OR IGNORE INTO connections
       (requester_party_id, addressee_party_id, pair_lo, pair_hi, relation_type, status, decided_at)
     VALUES (?,?,?,?,?, 'accepted', datetime('now'));`,
    [a, b, lo, hi, relationType],
  );
  const rows = (await db.execute(
    "SELECT id FROM connections WHERE pair_lo = ? AND pair_hi = ? AND relation_type = ?;",
    [lo, hi, relationType])).rows ?? [];
  if (rows.length === 0) return;
  await ensureThread(db, Number(rows[0].id), a, b, STARTERS[starterIdx % STARTERS.length]);
}

export async function backfillConnections(db: DB): Promise<void> {
  await db.transaction(async (tx) => {
    let i = 0;

    /* --------------------------------------- farmer <-> own FPO, "trade" -- */
    const memberships = (await tx.execute(
      `SELECT fp.id AS farmer_party, op.id AS fpo_party
         FROM memberships m
         JOIN parties fp ON fp.kind = 'farmer' AND fp.entity_id = m.farmer_id
         JOIN parties op ON op.kind = 'fpo'    AND op.entity_id = m.fpo_id
        WHERE m.status = 'active';`)).rows ?? [];
    for (const r of memberships as Row[]) {
      await connect(tx, Number(r.farmer_party), Number(r.fpo_party), "trade", i++);
    }

    /* -------------------------------- FPO <-> buyer, "trade" (reviewed) --- */
    const traded = (await tx.execute(
      `SELECT DISTINCT author_party_id AS buyer_party, subject_party_id AS fpo_party
         FROM reviews_v2;`)).rows ?? [];
    for (const r of traded as Row[]) {
      await connect(tx, Number(r.buyer_party), Number(r.fpo_party), "trade", i++);
    }

    /* ------------------------------------ FPO <-> supplier, "supply" ------ */
    const fpos = (await tx.execute("SELECT id FROM parties WHERE kind = 'fpo' ORDER BY id;")).rows ?? [];
    const suppliers = (await tx.execute(
      "SELECT id FROM parties WHERE kind = 'supplier' ORDER BY id;")).rows ?? [];
    if (suppliers.length > 0) {
      for (const f of fpos as Row[]) {
        const supplier = suppliers[Number(f.id) % suppliers.length];
        await connect(tx, Number(f.id), Number(supplier.id), "supply", i++);
      }
    }

    /* -------------------------------- farmer <-> farmer, "peer" ----------- */
    // Consecutive members of the same FPO, by party id — a stand-in for "farmers
    // who know each other through the same FPO", which is what the peer relation
    // on the farmer Connect screen represents.
    const rosters = (await tx.execute(
      `SELECT fp.id AS farmer_party, m.fpo_id
         FROM memberships m
         JOIN parties fp ON fp.kind = 'farmer' AND fp.entity_id = m.farmer_id
        WHERE m.status = 'active'
        ORDER BY m.fpo_id, fp.id;`)).rows ?? [];
    const byFpo = new Map<string, number[]>();
    for (const r of rosters as Row[]) {
      const key = String(r.fpo_id);
      const list = byFpo.get(key) ?? [];
      list.push(Number(r.farmer_party));
      byFpo.set(key, list);
    }
    for (const list of byFpo.values()) {
      for (let j = 0; j + 1 < list.length && j < 6; j += 2) {
        await connect(tx, list[j], list[j + 1], "peer", i++);
      }
    }
  });
}
