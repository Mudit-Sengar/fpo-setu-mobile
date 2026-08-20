import type { DB } from "@op-engineering/op-sqlite";

/**
 * Seeds a handful of replies to open requests, from the opposite-side persona.
 *
 * backfillRequests (see requestsBackfill.ts) carries the legacy posting tables
 * into `requests`, but nobody had ever replied to any of them — every FPO/buyer/
 * supplier inbox opened empty. A request with no replies is a normal, real state
 * (most postings never get answered), so this deliberately leaves most requests
 * alone and only answers some, picked deterministically off the request id so
 * reruns don't pile up duplicate replies (the UNIQUE (request_id, responder_party_id)
 * constraint would block them anyway).
 *
 * Responses are seeded as 'pending' only. An 'accepted' response is expected to
 * have a matching order (see orderRepository.createFromAcceptedResponse) —
 * synthesising that pairing here would duplicate what orderBackfill already does
 * for the pre-existing transaction/ledger data.
 */

const RESPONDER_KIND: Record<string, string[]> = {
  commodity_supply: ["buyer"],
  commodity_demand: ["fpo", "farmer"],
  input_demand: ["supplier"],
  input_supply: ["fpo", "farmer"],
};

const MESSAGES = [
  "Interested — can you share quality certificates?",
  "We can take this quantity at the listed terms.",
  "Would like to inspect before confirming.",
  "Can arrange pickup if the price is negotiable.",
  "This matches our current requirement.",
  "Can we settle on partial quantity for now?",
];

interface Row { [k: string]: unknown }

export async function backfillResponses(db: DB): Promise<void> {
  const requests = (await db.execute(
    "SELECT id, kind, author_party_id, qty, price_expectation FROM requests WHERE status = 'open';",
  )).rows ?? [];

  await db.transaction(async (tx) => {
    let messageIdx = 0;
    for (const r of requests as Row[]) {
      const kind = String(r.kind);
      const kinds = RESPONDER_KIND[kind];
      if (kinds == null) continue;

      const placeholders = kinds.map(() => "?").join(",");
      const candidates = (await tx.execute(
        `SELECT id FROM parties WHERE kind IN (${placeholders}) AND is_active = 1 AND id <> ?
           ORDER BY id LIMIT 5;`,
        [...kinds, Number(r.author_party_id)],
      )).rows ?? [];
      if (candidates.length === 0) continue;

      const reqId = Number(r.id);
      // Answer roughly one in three postings, with 1-2 replies each, spreading
      // across candidates by request id so different requests get different
      // responders instead of always the same first two parties.
      if (reqId % 3 !== 0) continue;

      const replyCount = candidates.length >= 2 && reqId % 2 === 0 ? 2 : 1;
      const picks = new Set<number>();
      for (let i = 0; i < replyCount; i++) {
        picks.add(Number(candidates[(reqId + i) % candidates.length].id));
      }

      const qty = Number(r.qty ?? 0);
      const offeredQty = qty > 0 ? Math.max(1, Math.round(qty * 0.8)) : null;
      const price = r.price_expectation == null ? null : Number(r.price_expectation);

      for (const partyId of picks) {
        await tx.execute(
          `INSERT OR IGNORE INTO request_responses
             (request_id, responder_party_id, message, offered_qty, offered_price, offered_unit, status)
           VALUES (?,?,?,?,?,?,'pending');`,
          [reqId, partyId, MESSAGES[messageIdx % MESSAGES.length], offeredQty, price, null],
        );
        messageIdx++;
      }
    }
  });
}
