/**
 * Krishi Bandhu — centralised intent → navigation mapping.
 *
 * This is the single source of truth for "what the farmer said" → "where to go".
 * Typed commands and speech-recognition transcripts both flow through
 * `resolveFarmerIntent()`, so the two input modes can never drift apart.
 *
 * ADDING AN INTENT
 * ----------------
 * Append an entry to INTENTS. Order matters: the first match wins, so put more
 * specific intents above more general ones (e.g. "nearby FPO" before "my FPO",
 * otherwise the bare word "fpo" would swallow it). Nothing else needs changing —
 * the screen just calls resolveFarmerIntent() and navigates to `destination`.
 */

/** Where an intent sends the farmer. `sub` selects a section within a tab. */
export type FarmerDestination =
  | { kind: "tab"; tab: "FarmerHome" }
  | { kind: "tab"; tab: "MyFpo"; sub?: "market" | "fpo" | "near" }
  | { kind: "tab"; tab: "Learn"; sub?: "courses" | "stories" }
  | { kind: "tab"; tab: "Connect"; sub?: "buyers" | "farmers" }
  | { kind: "tab"; tab: "Schemes" }
  | { kind: "screen"; screen: "FarmerProfile" };

export interface FarmerIntent {
  id: string;
  /** Shown in the confirmation toast, e.g. "Opening Market Insights". */
  label: string;
  /** Any match sends the farmer to `destination`. Case-insensitive. */
  patterns: RegExp[];
  destination: FarmerDestination;
}

/**
 * Ordered most-specific first. Patterns cover natural variations rather than
 * exact phrases, including common Hinglish/Marathi words farmers actually use
 * (bhav = price, yojana = scheme, anudan = subsidy).
 */
export const INTENTS: FarmerIntent[] = [
  {
    id: "profile",
    label: "your profile",
    patterns: [
      /\b(my )?(profile|account)\b/,
      /\b(my )?(details|information|info)\b.*\b(me|mine|my)\b/,
      /\bagri ?stack\b/,
      /\b(farmer )?id\b/,
      /प्रोफाइल/,
    ],
    destination: { kind: "screen", screen: "FarmerProfile" },
  },
  {
    id: "success-stories",
    label: "Success Stories",
    patterns: [
      /\bsuccess\b/,
      /\bstor(y|ies)\b/,
      /\btestimonial/,
      /\binspir/,
      /\bother farmers?\b.*\b(did|achieved|earned)\b/,
      /यशोगाथा/,
    ],
    destination: { kind: "tab", tab: "Learn", sub: "stories" },
  },
  {
    id: "fpo-nearby",
    label: "FPOs Near Me",
    patterns: [
      /\b(near|nearby|closest|around)\b/,
      /\bjoin\b.*\bfpo\b/,
      /\bfpo\b.*\bjoin\b/,
      /\b(find|search|discover|new|apply|which)\b.*\bfpo/,
      /\bmembership\b.*\b(apply|join|new)\b/,
      /जवळ(चे|चा)?/,
    ],
    destination: { kind: "tab", tab: "MyFpo", sub: "near" },
  },
  {
    id: "market-price",
    label: "Market Insights",
    patterns: [
      /\bprice(s)?\b/,
      /\bmandi\b/,
      /\bmarket\b/,
      /\bapmc\b/,
      /\brate(s)?\b/,
      /\bbhav\b/,
      /भाव/,
      /बाजार/,
      /\btrend\b/,
      /किंमत/,
    ],
    destination: { kind: "tab", tab: "MyFpo", sub: "market" },
  },
  {
    id: "schemes",
    label: "Government Schemes",
    patterns: [
      /\bscheme(s)?\b/,
      /\bsubsid(y|ies)\b/,
      /\bgovern?ment\b/,
      /\bgovt\b/,
      /\byojana\b/,
      /\bpm[- ]?kisan\b/,
      /\bkcc\b/,
      /\bkisan credit\b/,
      /\bpmfby\b/,
      /\b(crop )?insurance\b/,
      /\bloan\b/,
      /\bwaiver\b/,
      /योजना/,
      /अनुदान/,
    ],
    destination: { kind: "tab", tab: "Schemes" },
  },
  {
    id: "connect-farmers",
    label: "Connect with Similar Farmers",
    patterns: [
      /\b(other|another|similar|fellow|nearby)\b.*\bfarmer/,
      /\bfarmer(s)?\b.*\b(connect|group|pool|together|collective)\b/,
      /\b(pool|aggregate|collective|group)\b.*\b(harvest|produce|crop)\b/,
      /शेतकर(ी|्यां)/,
    ],
    destination: { kind: "tab", tab: "Connect", sub: "farmers" },
  },
  {
    id: "connect-buyers",
    label: "Connect with Buyers",
    patterns: [
      /\bbuyer(s)?\b/,
      /\bsell\b/,
      /\bselling\b/,
      /\bpurchaser\b/,
      /\btrader\b/,
      /\bprocure/,
      /खरेदीदार/,
      /विक्री/,
    ],
    destination: { kind: "tab", tab: "Connect", sub: "buyers" },
  },
  {
    id: "learn",
    label: "Learn",
    patterns: [
      /\blearn\b/,
      /\bcourse(s)?\b/,
      /\btraining\b/,
      /\btrain\b/,
      /\bvideo(s)?\b/,
      /\btutorial\b/,
      /\bteach\b/,
      /\beducat/,
      /\bhow (to|do)\b/,
      /\bwhat is an? fpo\b/,
      /शिक/,
      /अभ्यासक्रम/,
    ],
    destination: { kind: "tab", tab: "Learn", sub: "courses" },
  },
  {
    id: "my-fpo",
    label: "My FPO",
    patterns: [
      /\bmy fpo\b/,
      /\btransaction(s)?\b/,
      /\bmembership\b/,
      /\bmember\b/,
      /\bshare(holding)?\b/,
      /\bprofit\b/,
      /\bequity\b/,
      /\bdividend\b/,
      /\bearning(s)?\b/,
      /\bledger\b/,
      /\bfpo\b/,
      /माझा एफपीओ/,
      /एफपीओ/,
    ],
    destination: { kind: "tab", tab: "MyFpo", sub: "fpo" },
  },
  {
    id: "home",
    label: "Home",
    patterns: [/home/, /main menu/, /start/, /मुख्य/],
    destination: { kind: "tab", tab: "FarmerHome" },
  },
];

/**
 * Resolve free text (typed or spoken) to an intent. Returns null when nothing
 * matches, so the caller can show a helpful hint instead of navigating.
 */
export function resolveFarmerIntent(input: string): FarmerIntent | null {
  const text = input.toLowerCase().trim();
  if (text.length === 0) return null;
  for (const intent of INTENTS) {
    if (intent.patterns.some((p) => p.test(text))) return intent;
  }
  return null;
}

/** Example prompts surfaced in the UI when nothing matched. */
export const INTENT_EXAMPLES = [
  "onion price today",
  "government schemes",
  "connect me with a buyer",
  "show my transactions",
  "FPOs near me",
];
