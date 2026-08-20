/**
 * Domain types returned by the repositories.
 *
 * These are re-exported from src/lib/mockData.ts deliberately: the shapes are
 * identical, and a type-only re-export is erased at compile time — so screens
 * importing them carry NO runtime dependency on the seed arrays. mockData.ts
 * survives purely as the seed source (see src/db/seed.ts).
 */
export type {
  Buyer,
  BuyerType,
  CourseItem,
  Farmer,
  FarmerScheme,
  FarmerTxn,
  FPO,
  FpoCumulative,
  FpoMeeting,
  FPOSupply,
  InputNeed,
  MemberEngagement,
  Mentor,
  OpportunityDetail,
  Scheme,
  Supplier,
  SupplyPosting,
  Thumb,
  Tier,
} from "../lib/mockData";

/** A buyer-posted demand. Was buyer-storage.ts's `Demand`. */
export interface Demand {
  id: string;
  commodity: string;
  qty_mt: number;
  delivery: string;
  grade: string;
  location: string;
}

/** A supplier-posted supply. Was buyer-storage.ts's `SupplyPost`. */
export interface SupplyPost {
  id: string;
  item: string;
  category: string;
  qty: string;
  pricePerUnit: string;
  region: string;
  window: string;
}

/** A buyer/supplier review. Previously never persisted (local useState only). */
export interface Review {
  id?: number;
  targetId: string;
  targetType: "fpo" | "supplier";
  quality: number;
  delivery: number;
  communication: number;
  note: string;
  createdAt?: string;
}

/** A farmer success story. Was LearnScreen.tsx's local STORIES array. */
export interface Story {
  title: string;
  duration: string;
  transcript: string;
  thumbKey: string;
}

/** Per-FPO monthly aggregate. Was hardcoded constants in MyFpoScreen.tsx. */
export interface FpoMonthlySummary {
  monthSoldQ: number;
  sellPrice: number;
  onwardPrice: number;
  fpoProfit: number;
}

/**
 * A row in an FPO's books.
 *
 * `counterpartyPartyId` replaces the free-text `counterpartyId`, which held a
 * farmer id, a buyer id or a literal like 'FPO-POOL' depending on the row.
 * `counterpartyLabel` carries the cases that genuinely name no party.
 */
export interface LedgerEntry {
  date: string;
  desc: string;
  type: "Income" | "Expense";
  amount: number;
  balance: number;
  counterpartyPartyId?: number | null;
  counterpartyLabel?: string | null;
  /** Resolved for display; empty when the counterparty is a label. */
  counterpartyName?: string;
  orderId?: number | null;
  refId?: string;
}

/** Kinds stored in the `lookup_values` table. */
export type LookupKind = "commodity" | "season" | "state" | "certification" | "crop";
