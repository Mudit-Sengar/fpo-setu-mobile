/**
 * Migration 008 — reviews that mean something.
 *
 * The old `reviews` table had a target and three scores but no author and no
 * trade: a buyer could rate any FPO in the dropdown, including ones they had
 * never dealt with, as many times as they liked. Meanwhile the FPO's own "Seller
 * feedback (from buyers)" screen read a completely different table,
 * `seller_feedback`, keyed by the buyer's name in a text column — so the review a
 * buyer wrote and the feedback an FPO saw were two unrelated sets of rows.
 *
 * `reviews_v2` has an author, a subject and an order. That last one is what makes
 * a rating evidence of something: you can only review a counterparty you actually
 * traded with, once per order.
 *
 * `fpos.reputation` and `fpos.reviews` were frozen seed columns that no write
 * ever touched. They stay for now (unread) and `v_party_reputation` computes the
 * real figures, so a submitted review changes the rating that matching uses.
 */
export const MIGRATION_008: string[] = [
  `CREATE TABLE IF NOT EXISTS reviews_v2 (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    author_party_id  INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    subject_party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    order_id         INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    quality          INTEGER CHECK (quality       BETWEEN 1 AND 5),
    delivery         INTEGER CHECK (delivery      BETWEEN 1 AND 5),
    communication    INTEGER CHECK (communication BETWEEN 1 AND 5),
    note             TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    source_ref       TEXT UNIQUE,
    CHECK (author_party_id <> subject_party_id)
  );`,

  // One review per counterparty per order. Ratings without an order (the migrated
  // legacy rows) are exempt, since they have nothing to be unique against.
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_review_per_order
     ON reviews_v2(author_party_id, order_id) WHERE order_id IS NOT NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_subject ON reviews_v2(subject_party_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_author  ON reviews_v2(author_party_id);`,

  // Reputation becomes a computation. Averaging the three scores per review first
  // and then across reviews keeps a review that skipped a dimension from counting
  // as a zero.
  `CREATE VIEW IF NOT EXISTS v_party_reputation AS
     SELECT subject_party_id AS party_id,
            ROUND(AVG((COALESCE(quality, 0) + COALESCE(delivery, 0) + COALESCE(communication, 0))
                      / NULLIF((CASE WHEN quality IS NULL THEN 0 ELSE 1 END
                              + CASE WHEN delivery IS NULL THEN 0 ELSE 1 END
                              + CASE WHEN communication IS NULL THEN 0 ELSE 1 END), 0)), 2) AS rating,
            COUNT(*) AS review_count
       FROM reviews_v2
      GROUP BY subject_party_id;`,
];
