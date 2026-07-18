export function createLivePresentationSubscriptions<TId>(
  start: (id: TId) => void,
  release: (id: TId) => void,
) {
  const listeners = new Map<TId, Set<() => void>>()
  return {
    has: (id: TId) => listeners.has(id),
    publish: (id: TId) => {
      for (const listener of listeners.get(id) ?? []) listener()
    },
    subscribe: (id: TId, listener: () => void) => {
      const idListeners = listeners.get(id) ?? new Set()
      idListeners.add(listener)
      listeners.set(id, idListeners)
      start(id)
      return () => {
        idListeners.delete(listener)
        if (idListeners.size > 0) return
        listeners.delete(id)
        release(id)
      }
    },
    clear: () => listeners.clear(),
  }
}
