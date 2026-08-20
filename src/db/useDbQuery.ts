import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { dataVersion, subscribeToData } from "./invalidation";

/**
 * Load data from a repository into component state.
 *
 * Formalises the pattern BuyerHomeScreen already used for AsyncStorage
 * (`useState` + `useEffect(() => { void load().then(set); }, [])`), so every screen
 * reads from SQLite the same way.
 *
 * Re-runs whenever its deps change AND whenever anything is written, wherever that
 * write happened — see src/db/invalidation.ts. That is what keeps two components
 * reading the same rows in agreement: a reply accepted in one section updates the
 * badge in another without either knowing the other exists.
 *
 * There is deliberately no `reload` in the return: it used to be how a screen
 * refreshed itself after its own write, and every one of those call sites became
 * dead the moment writes invalidated globally. Keeping it would invite a screen to
 * refresh only itself again.
 *
 * On error the previous/initial value is kept — screens degrade to an empty list
 * rather than crashing, matching how the old mock arrays could never fail.
 */
export function useDbQuery<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
  initial: T,
): T {
  const [value, setValue] = useState<T>(initial);

  // Re-renders this component whenever any write lands, and gives the effect
  // below a dependency that changes with it.
  const version = useSyncExternalStore(subscribeToData, dataVersion, dataVersion);

  // Keep the latest loader without making it a dependency — callers pass inline
  // arrows, which would otherwise re-fire the effect on every render.
  const loaderRef = useRef(loader);
  useEffect(() => { loaderRef.current = loader; }, [loader]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await loaderRef.current();
        if (!cancelled) setValue(result);
      } catch {
        // Keep the last good value.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-supplied deps, plus `version` so any write anywhere re-runs this.
  }, [...deps, version]);

  return value;
}
