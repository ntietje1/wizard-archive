import type { ResourceKnowledge } from '@wizard-archive/editor/resources/index-contract'

const UNKNOWN_PRESENTATION = { state: 'unknown' } as const

export function createLivePresentationStore<TId, TPresentation>(
  watch: ((id: TId, apply: (value: TPresentation | null) => void) => () => void) | null,
) {
  const presentations = new Map<TId, ResourceKnowledge<TPresentation>>()
  const watches = new Map<TId, () => void>()
  const listeners = new Map<TId, Set<() => void>>()
  return {
    get: (id: TId): ResourceKnowledge<TPresentation> => {
      return presentations.get(id) ?? UNKNOWN_PRESENTATION
    },
    load: (id: TId) => {
      if (!watch || watches.has(id)) return
      watches.set(
        id,
        watch(id, (presentation) => {
          presentations.set(
            id,
            presentation === null ? { state: 'missing' } : { state: 'known', value: presentation },
          )
          for (const listener of listeners.get(id) ?? []) listener()
        }),
      )
    },
    subscribe: (id: TId, listener: () => void) => {
      const idListeners = listeners.get(id) ?? new Set()
      idListeners.add(listener)
      listeners.set(id, idListeners)
      return () => {
        idListeners.delete(listener)
        if (idListeners.size === 0) listeners.delete(id)
      }
    },
    dispose: () => {
      for (const dispose of watches.values()) dispose()
      watches.clear()
      listeners.clear()
      presentations.clear()
    },
  }
}
