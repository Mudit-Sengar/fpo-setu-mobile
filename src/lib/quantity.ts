/**
 * Reading a quantity out of the free text this app collects.
 *
 * Commodity quantities are numeric MT everywhere, but input quantities are typed
 * by hand and arrive as "120 kg", "8 MT", "600 L", "2,000 kg" or
 * "12 units × 4 days". Matching needs a number; the screen needs the words the
 * user actually wrote. So both are kept: `qty` + `unit` for comparison, and the
 * original string for display.
 */

export type Unit = "MT" | "Quintal" | "Kg" | "L" | "unit";

export const UNITS: Unit[] = ["MT", "Quintal", "Kg", "L", "unit"];

/** Maps the unit words that appear in this app's data onto the stored enum. */
function toUnit(word: string | undefined): Unit {
  switch ((word ?? "").toLowerCase()) {
    case "mt":
    case "tonne":
    case "tonnes":
    case "ton":
    case "tons": return "MT";
    case "q":
    case "quintal":
    case "quintals": return "Quintal";
    case "kg":
    case "kgs": return "Kg";
    case "l":
    case "litre":
    case "litres":
    case "liter":
    case "liters": return "L";
    default: return "unit";
  }
}

export interface ParsedQuantity {
  qty: number;
  unit: Unit;
  /** The text as given, preserved for display. */
  label: string;
}

/**
 * Pulls the leading number and its unit out of a quantity string.
 *
 * Returns `qty: 0` when there is no number to find rather than guessing — a
 * request that cannot be compared numerically should rank last, not rank as if
 * it were enormous.
 */
export function parseQuantity(text: string): ParsedQuantity {
  const label = text.trim();
  // Leading number (with optional thousands separators / decimal), then an
  // optional unit word immediately after it.
  const m = /^\s*([\d,]+(?:\.\d+)?)\s*([A-Za-z]+)?/.exec(label);
  if (m == null) return { qty: 0, unit: "unit", label };
  const qty = Number(m[1].replace(/,/g, ""));
  return {
    qty: Number.isFinite(qty) ? qty : 0,
    unit: toUnit(m[2]),
    label,
  };
}

/** Formats a stored quantity back into something to show. */
export function formatQuantity(qty: number, unit: string, label?: string | null): string {
  if (label != null && label !== "") return label;
  return `${qty} ${unit}`;
}
