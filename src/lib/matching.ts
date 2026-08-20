/**
 * How well two sides of a trade fit.
 *
 * The match percentages on the buyer, supplier and FPO screens were
 * `92 - index * 6` — the number went down as you read down the list, so the
 * "94% match" at the top meant nothing except "first". This computes a score
 * from the request data instead.
 *
 * Pure and synchronous on purpose: it is business logic over row data, so it
 * belongs in code where it can be read and tested, not in SQL.
 *
 * Locality is a decay over real kilometres, read from the precomputed
 * `district_distances` matrix. It replaced district equality, which had in turn
 * replaced a distance derived from a character of the FPO's id string.
 */

/** Grades in ascending order of quality, as used across this app's data. */
const GRADE_RANK: Record<string, number> = {
  b: 1,
  a: 2,
  sortex: 3,
  export: 4,
};

function rankOf(grade: string | null | undefined): number | null {
  const r = GRADE_RANK[(grade ?? "").trim().toLowerCase()];
  return r ?? null;
}

export interface MatchInput {
  /** What the asking side needs. 0 when they did not say. */
  requiredQty: number;
  /** What the offering side has. */
  availableQty: number;
  requiredGrade?: string | null;
  offeredGrade?: string | null;
  /**
   * Kilometres between the two parties, from `district_distances`. Null when
   * either side has no district resolved — which scores neutral rather than
   * penalising a party for missing data.
   */
  distanceKm?: number | null;
  /** The offering side's rating out of 5, and how many reviews it rests on. */
  rating?: number;
  reviewCount?: number;
}

export interface MatchBreakdown {
  score: number;
  quantity: number;
  grade: number;
  locality: number;
  reputation: number;
}

// Quantity dominates: an FPO that cannot cover the order is a worse match than
// one a grade lower that can. Locality is the lightest because it is the
// crudest signal until real distances land.
const WEIGHT = { quantity: 40, grade: 25, locality: 15, reputation: 20 } as const;

/**
 * Fraction of the requirement that can be covered, capped at 1.
 * An unstated requirement scores full — there is nothing to fall short of.
 */
function quantityFit(requiredQty: number, availableQty: number): number {
  if (requiredQty <= 0) return 1;
  if (availableQty <= 0) return 0;
  return Math.min(1, availableQty / requiredQty);
}

/**
 * Meeting or beating the asked-for grade scores full; one step below still
 * scores partly, because a buyer may accept it at a lower price. Two or more
 * steps below scores nothing. An unknown grade on either side is neutral.
 */
function gradeFit(requiredGrade: string | null | undefined, offeredGrade: string | null | undefined): number {
  const need = rankOf(requiredGrade);
  const have = rankOf(offeredGrade);
  if (need == null || have == null) return 0.75;
  if (have >= need) return 1;
  return need - have === 1 ? 0.5 : 0;
}

/**
 * Closeness, decaying with distance.
 *
 * Exponential rather than a cliff: an FPO 60 km away is meaningfully better than
 * one 300 km away, and both are worth showing. The 200 km scale means a
 * neighbouring district still scores high and the far side of the state scores
 * low without ever reaching zero, since a distant FPO that can cover the whole
 * order may still be the right answer. Unknown distance scores neutral.
 */
function localityFit(distanceKm?: number | null): number {
  if (distanceKm == null) return 0.6;
  return Math.max(0.15, Math.exp(-Math.max(0, distanceKm) / 200));
}

/**
 * Rating out of 5, scaled to 0-1 and damped by how many reviews back it.
 *
 * An unrated party scores neutral rather than zero: a new FPO with no history is
 * unproven, not bad, and zeroing them would make it impossible to ever win a
 * first order. The damping stops one five-star review outranking forty
 * four-star ones — it takes about five reviews to earn the full weight.
 */
function reputationFit(rating?: number, reviewCount?: number): number {
  if (rating == null || reviewCount == null || reviewCount === 0) return 0.6;
  const confidence = Math.min(1, reviewCount / 5);
  const normalised = Math.max(0, Math.min(1, rating / 5));
  return 0.6 + (normalised - 0.6) * confidence;
}

export function matchScore(input: MatchInput): MatchBreakdown {
  const quantity = quantityFit(input.requiredQty, input.availableQty);
  const grade = gradeFit(input.requiredGrade, input.offeredGrade);
  const locality = localityFit(input.distanceKm);
  const reputation = reputationFit(input.rating, input.reviewCount);

  const score = Math.round(
    quantity * WEIGHT.quantity + grade * WEIGHT.grade
    + locality * WEIGHT.locality + reputation * WEIGHT.reputation,
  );

  return { score, quantity, grade, locality, reputation };
}

/** Why a match scored what it did, for the line under the badge. */
export function explainMatch(b: MatchBreakdown): string {
  const parts: string[] = [];
  parts.push(b.quantity >= 1 ? "covers the full quantity" : `covers ${Math.round(b.quantity * 100)}% of the quantity`);
  if (b.grade >= 1) parts.push("grade met");
  else if (b.grade > 0.5) parts.push("grade unstated");
  else if (b.grade > 0) parts.push("one grade below");
  else parts.push("grade below requirement");
  if (b.locality >= 0.95) parts.push("same district");
  else if (b.locality >= 0.6) parts.push("nearby");
  else if (b.locality > 0.3) parts.push("some distance away");
  else parts.push("far away");
  if (b.reputation > 0.6) parts.push("well rated");
  else if (b.reputation < 0.6) parts.push("rated below average");
  return parts.join(" · ");
}
