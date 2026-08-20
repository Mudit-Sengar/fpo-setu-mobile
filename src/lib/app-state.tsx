import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { initDatabase } from "../db";
import { authService, type Session, type SignInResult, type ViewRole } from "../services/authService";

export type Lang = "en" | "hi" | "mr";
/** The role whose view is open. Kept as `Role` so existing consumers still read. */
export type Role = ViewRole;

// Ported verbatim from the web app's src/lib/app-state.tsx
const STRINGS: Record<string, { en: string; hi: string; mr: string }> = {
  appName: { en: "FPO Setu", hi: "एफपीओ सेतु", mr: "एफपीओ सेतू" },
  tagline: {
    en: "Connecting Farmers, FPOs & Markets",
    hi: "किसान, एफपीओ और बाज़ार को जोड़ने वाला सेतु",
    mr: "शेतकरी, एफपीओ आणि बाजार जोडणारा सेतू",
  },
  // Not in the web app — every role's header says "Logout" instead of
  // "Switch Role". Same underlying behaviour (clears the persisted role).
  logout: { en: "Logout", hi: "लॉग आउट", mr: "बाहेर पडा" },
  farmer: { en: "Farmer", hi: "किसान", mr: "शेतकरी" },
  fpo: { en: "FPO", hi: "एफपीओ", mr: "एफपीओ" },
  buyer: { en: "Buyer", hi: "खरीदार", mr: "खरेदीदार" },
  discover: { en: "Discover", hi: "खोज", mr: "शोध" },
  myFpo: { en: "My FPO", hi: "मेरा एफपीओ", mr: "माझा एफपीओ" },
  learn: { en: "Learn", hi: "सीखें", mr: "शिका" },
};

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  hi: "हिन्दी",
  mr: "मराठी",
};

// Storage keys kept identical to the web app for continuity.
const K_LANG = "setu.lang";
/**
 * NOTE: there used to be a `setu.fpo` key holding the active FPO id, defaulting
 * to "fpo-1". Every FPO screen read it, so a stale or edited value pointed an FPO
 * login at another organisation's supply, meetings and ledger. It is now derived
 * from the session instead — see `activeFpoId` below — and the key is no longer
 * read or written.
 */
/**
 * Persisted session. Stores only the user id and which view was open — never the
 * password or a copy of the profile. Everything else is re-read from the database
 * on launch, so a user who has since been deactivated or had a role revoked does
 * not get in on a stale session.
 */
const K_SESSION = "setu.session";

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: keyof typeof STRINGS) => string;
  /**
   * The FPO whose data the FPO screens read and write. Derived from the session,
   * never from storage: it is the signed-in FPO's own id, and "" in any other
   * role (so a stray read returns no rows rather than another org's data).
   */
  activeFpoId: string;

  /** The authenticated session, or null when signed out. */
  session: Session | null;
  /** Active view role — null when signed out. Navigator keys off this. */
  role: Role | null;
  /**
   * The domain record backing the active view (`farmers.id` / `fpos.id` /
   * `buyers.id`). Screens read their profile from this instead of a constant.
   */
  profileId: string | null;
  /**
   * `parties.id` for the active profile — what a write records as its author.
   * Null when signed out.
   */
  partyId: number | null;
  signIn: (username: string, password: string, role: Role) => Promise<SignInResult>;
  /** Admin-only: open another role's view without signing in again. */
  switchRole: (role: Role) => Promise<boolean>;
  logout: () => void;
  /** True once persisted state has been read back from AsyncStorage. */
  ready: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  // Not state: there is exactly one correct answer at any moment, and it is the
  // session's. Holding a separate copy is what allowed it to drift.
  const activeFpoId = session?.activeRole === "fpo" ? session.profileId : "";

  // MIGRATION NOTE: the web app read localStorage synchronously inside useState
  // initialisers. AsyncStorage is async, so hydration moves into an effect and
  // `ready` now means "storage has been read" (the web app's `ready` only meant
  // "first effect has run"). Consumers use it the same way: gate redirects on it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Open/migrate/seed SQLite before anything renders — every screen now reads
        // its data through the repositories, so `ready` must also mean "DB usable".
        await initDatabase();
      } catch {
        // Screens degrade to empty lists rather than crashing on a DB failure.
      }
      try {
        const pairs = await AsyncStorage.multiGet([K_LANG, K_SESSION]);
        if (cancelled) return;
        const map = Object.fromEntries(pairs) as Record<string, string | null>;
        if (map[K_LANG]) setLangState(map[K_LANG] as Lang);

        if (map[K_SESSION]) {
          const { userId, activeRole } = JSON.parse(map[K_SESSION]) as
            { userId: number; activeRole: ViewRole };
          // Revalidated against the database, not trusted as stored.
          const restored = await authService.restore(userId, activeRole);
          if (cancelled) return;
          if (restored != null) {
            setSession(restored);
          } else {
            await AsyncStorage.removeItem(K_SESSION).catch(() => {});
          }
        }
      } catch {
        // Storage unavailable — fall back to in-memory defaults, same as the
        // web app's `typeof localStorage === "undefined"` guards.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    void AsyncStorage.setItem(K_LANG, l).catch(() => {});
  }, []);

  /** Applies a new session: state and storage. */
  const adoptSession = useCallback((s: Session) => {
    setSession(s);
    void AsyncStorage.setItem(
      K_SESSION, JSON.stringify({ userId: s.userId, activeRole: s.activeRole }),
    ).catch(() => {});
  }, []);

  const signIn = useCallback(async (username: string, password: string, r: Role) => {
    const result = await authService.signIn(username, password, r);
    if (result.ok) adoptSession(result.session);
    return result;
  }, [adoptSession]);

  const switchRole = useCallback(async (r: Role) => {
    if (session == null) return false;
    const next = await authService.switchRole(session, r);
    if (next == null) return false;
    adoptSession(next);
    return true;
  }, [session, adoptSession]);

  const logout = useCallback(() => {
    setSession(null);
    void AsyncStorage.removeItem(K_SESSION).catch(() => {});
  }, []);

  const value = useMemo<AppState>(() => ({
    lang,
    setLang,
    t: (k) => STRINGS[k]?.[lang] ?? String(k),
    activeFpoId,
    session,
    role: session?.activeRole ?? null,
    profileId: session?.profileId ?? null,
    partyId: session?.partyId ?? null,
    signIn,
    switchRole,
    logout,
    ready,
  }), [lang, setLang, activeFpoId, session, signIn, switchRole, logout, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppStateProvider missing");
  return v;
}
