import type * as Y from 'yjs'

/**
 * Returns a snapshot of the current Y.Map values while discarding keys.
 * Y.Map implements the iterable protocol and exposes `values()`, so this
 * preserves the same iteration order as `map.values()`/`map.forEach(...)`.
 * Callers should not rely on a semantic sort order after keys are dropped.
 */
export function yMapToArray<T>(map: Y.Map<T>): Array<T> {
  return Array.from(map.values())
}
