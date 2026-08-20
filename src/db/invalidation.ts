/**
 * Tells mounted queries that the database changed.
 *
 * Every screen loads through its own `useDbQuery`, so before this each component
 * only knew about writes it made itself. Accepting a reply in the FPO's Replies
 * section left the reply-count badge in its Post Request section stale, because
 * two different components were reading the same rows and neither could tell the
 * other. Any write now bumps a version that every query watches.
 *
 * Deliberately one global version rather than per-table topics. Reads here are
 * local, indexed SQLite queries and writes only happen on a button press, so the
 * cost of re-running a screen's handful of queries is not worth the risk of
 * someone adding a write and forgetting to declare which topic it touches — the
 * exact class of bug this replaces. Topics can be added if profiling ever asks
 * for them.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

/** Subscribes to writes. Returns the unsubscribe function useSyncExternalStore wants. */
export function subscribeToData(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The current data version. Changes on every write. */
export function dataVersion(): number {
  return version;
}

/**
 * Announces that something was written. Called by `withWrite`, so repositories
 * get this by using the right wrapper rather than by remembering to call it.
 */
export function notifyDataChanged(): void {
  version += 1;
  // Copied before iterating: a listener that unsubscribes while being notified
  // (a component unmounting mid-refresh) would otherwise mutate the live set.
  for (const listener of [...listeners]) listener();
}
