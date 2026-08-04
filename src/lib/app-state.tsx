import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "hi" | "mr";
export type Role = "farmer" | "fpo" | "buyer";

// Ported verbatim from the web app's src/lib/app-state.tsx
const STRINGS: Record<string, { en: string; hi: string; mr: string }> = {
  appName: { en: "FPO Setu", hi: "एफपीओ सेतु", mr: "एफपीओ सेतू" },
  tagline: {
    en: "Connecting Farmers, FPOs & Markets",
    hi: "किसान, एफपीओ और बाज़ार को जोड़ने वाला सेतु",
    mr: "शेतकरी, एफपीओ आणि बाजार जोडणारा सेतू",
  },
  switchRole: { en: "Switch Role", mr: "भूमिका बदला", hi: "भूमिका बदलें" },
  // Not in the web app — the Farmer header now says "Logout" instead of
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
const K_FPO = "setu.fpo";
const K_ROLE = "setu.role";

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: keyof typeof STRINGS) => string;
  activeFpoId: string;
  setActiveFpoId: (id: string) => void;
  role: Role | null;
  login: (role: Role) => void;
  logout: () => void;
  /** True once persisted state has been read back from AsyncStorage. */
  ready: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [activeFpoId, setActiveFpoIdState] = useState<string>("fpo-1");
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  // MIGRATION NOTE: the web app read localStorage synchronously inside useState
  // initialisers. AsyncStorage is async, so hydration moves into an effect and
  // `ready` now means "storage has been read" (the web app's `ready` only meant
  // "first effect has run"). Consumers use it the same way: gate redirects on it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([K_LANG, K_FPO, K_ROLE]);
        if (cancelled) return;
        const map = Object.fromEntries(pairs) as Record<string, string | null>;
        if (map[K_LANG]) setLangState(map[K_LANG] as Lang);
        if (map[K_FPO]) setActiveFpoIdState(map[K_FPO] as string);
        if (map[K_ROLE]) setRole(map[K_ROLE] as Role);
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

  const setActiveFpoId = useCallback((id: string) => {
    setActiveFpoIdState(id);
    void AsyncStorage.setItem(K_FPO, id).catch(() => {});
  }, []);

  const login = useCallback((r: Role) => {
    setRole(r);
    void AsyncStorage.setItem(K_ROLE, r).catch(() => {});
  }, []);

  const logout = useCallback(() => {
    setRole(null);
    void AsyncStorage.removeItem(K_ROLE).catch(() => {});
  }, []);

  const value = useMemo<AppState>(() => ({
    lang,
    setLang,
    t: (k) => STRINGS[k]?.[lang] ?? String(k),
    activeFpoId,
    setActiveFpoId,
    role,
    login,
    logout,
    ready,
  }), [lang, setLang, activeFpoId, setActiveFpoId, role, login, logout, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppStateProvider missing");
  return v;
}
