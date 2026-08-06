import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Load data from a repository into component state.
 *
 * Formalises the pattern BuyerHomeScreen already used for AsyncStorage
 * (`useState` + `useEffect(() => { void load().then(set); }, [])`), so every screen
 * reads from SQLite the same way. Returns the current value plus a `reload` to call
 * after a write.
 *
 * On error the previous/initial value is kept — screens degrade to an empty list
 * rather than crashing, matching how the old mock arrays could never fail.
 */
export function useDbQuery<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
  initial: T,
): [T, () => void] {
  const [value, setValue] = useState<T>(initial);
  const [tick, setTick] = useState(0);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-supplied deps, plus `tick` for manual reloads.
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return [value, reload];
}
