/**
 * Migration 007 — orders.
 *
 * The app already had a transaction spine; it was just made of strings. A
 * farmer's sale lived in `farmer_txns`, the FPO's side of the same sale lived in
 * `ledger_entries`, and the only thing joining them was a matching `ref_id`
 * ("LG-2026-0512-ON") typed into both. `counterparty_id` was free text that held
 * a farmer id, a buyer id, or a literal like 'FPO-POOL' depending on the row.
 *
 * An order is that spine made explicit: one row both sides point at, with a
 * seller, a buyer, a status and an amount. The buyer's order list, the FPO's
 * ledger, the farmer's history and — once 008 lands — the FPO's rating all read
 * from it, so they cannot disagree.
 *
 * `ON DELETE RESTRICT` on the two party columns is deliberate and differs from
 * the CASCADE used elsewhere: deleting an FPO must not take a farmer's payment
 * record with it. Parties are deactivated (`parties.is_active = 0`), not deleted.
 */
export const MIGRATION_007: string[] = [
  /* ------------------------------------------------------------ clusters -- */
  // The "Regional Cluster" the buyer matching screen assembles when no single FPO
  // can cover an order. It existed only inside a useMemo and vanished on unmount.
  `CREATE TABLE IF NOT EXISTS clusters (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    anchor_party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    for_request_id  INTEGER REFERENCES requests(id) ON DELETE SET NULL,
    commodity       TEXT NOT NULL,
    target_qty      REAL NOT NULL CHECK (target_qty > 0),
    unit            TEXT NOT NULL DEFAULT 'MT',
    status          TEXT NOT NULL DEFAULT 'forming' CHECK (status IN
                      ('forming','committed','fulfilled','dissolved')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS cluster_members (
    cluster_id    INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    party_id      INTEGER NOT NULL REFERENCES parties(id)  ON DELETE CASCADE,
    committed_qty REAL NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'invited' CHECK (status IN
                    ('invited','committed','declined','withdrawn')),
    PRIMARY KEY (cluster_id, party_id)
  );`,

  /* -------------------------------------------------------------- orders -- */
  `CREATE TABLE IF NOT EXISTS orders (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Supersedes the hand-typed "LG-2026-0512-ON" convention. Assigned from the
    -- row id after insert, so it is unique without a counter table.
    order_no           TEXT UNIQUE,
    seller_party_id    INTEGER NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    buyer_party_id     INTEGER NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    origin_request_id  INTEGER REFERENCES requests(id)          ON DELETE SET NULL,
    origin_response_id INTEGER REFERENCES request_responses(id) ON DELETE SET NULL,
    cluster_id         INTEGER REFERENCES clusters(id)          ON DELETE SET NULL,
    commodity          TEXT NOT NULL,
    grade              TEXT,
    qty                REAL NOT NULL CHECK (qty > 0),
    unit               TEXT NOT NULL DEFAULT 'MT',
    price_per_unit     REAL NOT NULL DEFAULT 0 CHECK (price_per_unit >= 0),
    total_amount       REAL NOT NULL DEFAULT 0,
    status             TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN
                         ('draft','confirmed','in_transit','delivered',
                          'paid','cancelled','disputed')),
    delivery_due       TEXT,
    delivered_at       TEXT,
    paid_at            TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
    source_ref         TEXT UNIQUE,
    CHECK (seller_party_id <> buyer_party_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_orders_seller  ON orders(seller_party_id, status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_buyer   ON orders(buyer_party_id,  status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_cluster ON orders(cluster_id);`,
  // One order per accepted response, so accepting twice cannot open two.
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_response
     ON orders(origin_response_id) WHERE origin_response_id IS NOT NULL;`,

  // A cluster order is one order split across several FPOs; each lot settles on
  // its own while the buyer deals with the anchor.
  `CREATE TABLE IF NOT EXISTS order_lots (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id          INTEGER NOT NULL REFERENCES orders(id)  ON DELETE CASCADE,
    supplier_party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    qty               REAL NOT NULL CHECK (qty > 0),
    unit              TEXT NOT NULL DEFAULT 'MT',
    price_per_unit    REAL NOT NULL DEFAULT 0,
    amount            REAL NOT NULL DEFAULT 0,
    status            TEXT NOT NULL DEFAULT 'pending'
  );`,
  `CREATE INDEX IF NOT EXISTS idx_order_lots_order ON order_lots(order_id);`,

  /* --------------------------------------------- real keys on the ledger -- */
  // `counterparty_id` stays for now, unread, as the recovery path for the
  // backfill that resolves it. Rows whose counterparty is not a party at all
  // ('FPO-POOL', 'MEMBERS-ALL') keep their text in counterparty_label.
  `ALTER TABLE ledger_entries ADD COLUMN counterparty_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;`,
  `ALTER TABLE ledger_entries ADD COLUMN counterparty_label TEXT;`,
  `ALTER TABLE ledger_entries ADD COLUMN order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_ledger_counterparty ON ledger_entries(counterparty_party_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ledger_order        ON ledger_entries(order_id);`,

  // Notifications can point at an order now that one exists.
  `ALTER TABLE notifications ADD COLUMN order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE;`,

  `ALTER TABLE farmer_txns ADD COLUMN order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;`,
  `ALTER TABLE farmer_txns ADD COLUMN membership_id INTEGER REFERENCES memberships(id) ON DELETE SET NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_farmer_txns_order ON farmer_txns(order_id);`,
];
