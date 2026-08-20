import type { DB } from "@op-engineering/op-sqlite";

/**
 * Turns the ref_id string convention into real orders, and gives the ledger a
 * foreign key instead of free text.
 *
 * Before this, a farmer selling to their FPO produced two rows that nothing
 * joined: a `farmer_txns` row and a `ledger_entries` row that happened to share
 * a `ref_id` like "LG-2026-0512-ON". Where that pairing exists it becomes one
 * order — seller the farmer, buyer the FPO — and both rows point at it.
 *
 * `ledger_entries.counterparty_id` held three different kinds of value depending
 * on the row: a farmer id, a buyer id, or a literal that names no party at all
 * ('FPO-POOL', 'MEMBERS-ALL', 'AgriTrans-LOG'). Each is resolved to a party where
 * one exists and moved to `counterparty_label` where one does not, rather than
 * guessing.
 *
 * Idempotent through `orders.source_ref`.
 */

const str = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));
const num = (v: unknown): number => Number(v ?? 0);

interface Row { [k: string]: unknown }

async function partyOf(db: DB, kind: string, entityId: string): Promise<number | null> {
  if (entityId === "") return null;
  const rows = (await db.execute(
    "SELECT id FROM parties WHERE kind = ? AND entity_id = ? LIMIT 1;", [kind, entityId])).rows ?? [];
  return rows.length === 0 ? null : Number(rows[0].id);
}

/** Any party with this entity id, whatever its kind. */
async function anyPartyOf(db: DB, entityId: string): Promise<number | null> {
  if (entityId === "") return null;
  const rows = (await db.execute(
    "SELECT id FROM parties WHERE entity_id = ? LIMIT 1;", [entityId])).rows ?? [];
  return rows.length === 0 ? null : Number(rows[0].id);
}

/** Assigns the human-facing order number from the row id. */
async function numberOrder(db: DB, sourceRef: string): Promise<number | null> {
  const rows = (await db.execute(
    "SELECT id FROM orders WHERE source_ref = ?;", [sourceRef])).rows ?? [];
  if (rows.length === 0) return null;
  const id = Number(rows[0].id);
  await db.execute(
    "UPDATE orders SET order_no = 'ORD-' || printf('%06d', id) WHERE id = ? AND order_no IS NULL;",
    [id]);
  return id;
}

export async function backfillOrders(db: DB): Promise<void> {
  /* ---------------- farmer_txns paired with ledger_entries by ref_id ------ */
  const paired = (await db.execute(
    `SELECT t.id AS txn_id, t.farmer_id, t.date, t.crop, t.qty_q, t.price, t.amount, t.ref_id,
            l.id AS ledger_id, l.fpo_id
       FROM farmer_txns t
       JOIN ledger_entries l ON l.ref_id = t.ref_id
      WHERE t.ref_id IS NOT NULL AND t.ref_id <> '' AND t.order_id IS NULL;`)).rows ?? [];

  for (const r of paired as Row[]) {
    const farmerParty = await partyOf(db, "farmer", str(r.farmer_id));
    const fpoParty = await partyOf(db, "fpo", str(r.fpo_id));
    if (farmerParty == null || fpoParty == null) continue;

    const sourceRef = `farmer_txns:${str(r.txn_id)}`;
    const qty = num(r.qty_q);
    if (qty <= 0) continue;

    await db.execute(
      `INSERT OR IGNORE INTO orders
         (seller_party_id, buyer_party_id, commodity, qty, unit, price_per_unit,
          total_amount, status, delivered_at, paid_at, created_at, source_ref)
       VALUES (?,?,?,?,'Quintal',?,?, 'paid', ?, ?, ?, ?);`,
      [farmerParty, fpoParty, str(r.crop), qty, num(r.price), num(r.amount),
        str(r.date), str(r.date), str(r.date), sourceRef]);

    const orderId = await numberOrder(db, sourceRef);
    if (orderId == null) continue;

    await db.execute("UPDATE farmer_txns SET order_id = ? WHERE id = ?;", [orderId, Number(r.txn_id)]);
    await db.execute("UPDATE ledger_entries SET order_id = ? WHERE id = ?;", [orderId, Number(r.ledger_id)]);
  }

  /* -------------- farmer_txns to their FPO with no matching ledger row ---- */
  // The pairing above only covers transactions the FPO also wrote down. A farmer
  // sale with no ledger counterpart is still a sale and still belongs in their
  // history, so it gets an order too — just without a ledger line attached.
  const unpaired = (await db.execute(
    `SELECT t.id AS txn_id, t.farmer_id, t.date, t.crop, t.qty_q, t.price, t.amount,
            m.fpo_id
       FROM farmer_txns t
       JOIN memberships m ON m.farmer_id = t.farmer_id AND m.status = 'active'
      WHERE t.order_id IS NULL AND t.qty_q > 0;`)).rows ?? [];

  for (const r of unpaired as Row[]) {
    const farmerParty = await partyOf(db, "farmer", str(r.farmer_id));
    const fpoParty = await partyOf(db, "fpo", str(r.fpo_id));
    if (farmerParty == null || fpoParty == null) continue;

    const sourceRef = `farmer_txns:${str(r.txn_id)}`;
    await db.execute(
      `INSERT OR IGNORE INTO orders
         (seller_party_id, buyer_party_id, commodity, qty, unit, price_per_unit,
          total_amount, status, delivered_at, paid_at, created_at, source_ref)
       VALUES (?,?,?,?,'Quintal',?,?, 'paid', ?, ?, ?, ?);`,
      [farmerParty, fpoParty, str(r.crop), num(r.qty_q), num(r.price), num(r.amount),
        str(r.date), str(r.date), str(r.date), sourceRef]);

    const orderId = await numberOrder(db, sourceRef);
    if (orderId != null) {
      await db.execute("UPDATE farmer_txns SET order_id = ? WHERE id = ?;", [orderId, Number(r.txn_id)]);
    }
  }

  /* ------------------------- link farmer_txns to the membership they sit under */
  await db.execute(
    `UPDATE farmer_txns SET membership_id = (
       SELECT m.id FROM memberships m
        WHERE m.farmer_id = farmer_txns.farmer_id AND m.status = 'active' LIMIT 1)
      WHERE membership_id IS NULL;`);

  /* -------------------- resolve the free-text ledger counterparty --------- */
  const ledger = (await db.execute(
    `SELECT id, counterparty_id FROM ledger_entries
      WHERE counterparty_id IS NOT NULL AND counterparty_id <> ''
        AND counterparty_party_id IS NULL AND counterparty_label IS NULL;`)).rows ?? [];

  for (const r of ledger as Row[]) {
    const raw = str(r.counterparty_id);
    const partyId = await anyPartyOf(db, raw);
    if (partyId != null) {
      await db.execute(
        "UPDATE ledger_entries SET counterparty_party_id = ? WHERE id = ?;", [partyId, Number(r.id)]);
    } else {
      // Names something real but not a party — a pooled procurement, a payout to
      // every member, a logistics vendor that has no record in this app yet.
      await db.execute(
        "UPDATE ledger_entries SET counterparty_label = ? WHERE id = ?;", [raw, Number(r.id)]);
    }
  }
}

/**
 * Moves the two legacy rating tables into `reviews_v2`.
 *
 * Neither had an author. `reviews` recorded only what was rated, and
 * `seller_feedback` recorded the buyer as a name in a text column. Both are
 * attributed as carefully as the data allows: the buyer name is resolved against
 * `buyers.name` where it matches, and anything unattributable is skipped rather
 * than credited to an arbitrary party.
 */
export async function backfillReviews(db: DB): Promise<void> {
  /* --------------------------------- seller_feedback (buyer named in text) */
  const feedback = (await db.execute(
    "SELECT id, fpo_id, buyer, commodity, qty_mt, date, stars, note FROM seller_feedback;")).rows ?? [];

  for (const r of feedback as Row[]) {
    const sourceRef = `seller_feedback:${str(r.id)}`;
    const subject = await partyOf(db, "fpo", str(r.fpo_id));
    if (subject == null) continue;

    // Resolve the buyer's name to a real buyer. Exactly one match or nothing:
    // two buyers sharing a name would make the attribution a coin toss.
    const matches = (await db.execute(
      `SELECT p.id FROM buyers b
         JOIN parties p ON p.kind = 'buyer' AND p.entity_id = b.id
        WHERE b.name = ?;`, [str(r.buyer)])).rows ?? [];
    if (matches.length !== 1) continue;
    const author = Number(matches[0].id);
    if (author === subject) continue;

    const stars = num(r.stars);
    await db.execute(
      `INSERT OR IGNORE INTO reviews_v2
         (author_party_id, subject_party_id, quality, delivery, communication, note, created_at, source_ref)
       VALUES (?,?,?,?,?,?,?,?);`,
      [author, subject, stars, stars, stars,
        str(r.note), str(r.date, "") || null, sourceRef]);
  }

  /* -------------------------------------- reviews (no author at all) ------ */
  // These were written by whoever was signed in as a buyer on this device, and
  // the table never recorded which. Attributing them to a specific buyer would be
  // inventing evidence, so they carry over only when exactly one buyer exists —
  // the single-account case where the answer is not in doubt.
  const buyers = (await db.execute(
    "SELECT p.id FROM buyers b JOIN parties p ON p.kind = 'buyer' AND p.entity_id = b.id;")).rows ?? [];
  if (buyers.length !== 1) return;
  const soleBuyer = Number(buyers[0].id);

  const legacy = (await db.execute(
    "SELECT id, target_id, target_type, quality, delivery, communication, note, created_at FROM reviews;")).rows ?? [];

  for (const r of legacy as Row[]) {
    const subject = await partyOf(db, str(r.target_type), str(r.target_id));
    if (subject == null || subject === soleBuyer) continue;
    await db.execute(
      `INSERT OR IGNORE INTO reviews_v2
         (author_party_id, subject_party_id, quality, delivery, communication, note, created_at, source_ref)
       VALUES (?,?,?,?,?,?,?,?);`,
      [soleBuyer, subject, num(r.quality), num(r.delivery), num(r.communication),
        str(r.note), str(r.created_at, "") || null, `reviews:${str(r.id)}`]);
  }
}
