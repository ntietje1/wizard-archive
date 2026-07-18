import type { ResourceKnowledge } from '@wizard-archive/editor/resources/index-contract'
import { createLivePresentationSubscriptions } from './live-presentation-subscriptions'

const UNKNOWN_PRESENTATION = { state: 'unknown' } as const

export function createLivePresentationStore<TId, TPresentation>(
  watch: ((id: TId, apply: (value: TPresentation | null) => void) => () => void) | null,
) {
  const presentations = new Map<TId, ResourceKnowledge<TPresentation>>()
  const watches = new Map<TId, () => void>()
  const start = (id: TId) => {
    if (!watch || watches.has(id) || !subscriptions.has(id)) return
    watches.set(
      id,
      watch(id, (presentation) => {
        presentations.set(
          id,
          presentation === null ? { state: 'missing' } : { state: 'known', value: presentation },
        )
        subscriptions.publish(id)
      }),
    )
  }
  const release = (id: TId) => {
    watches.get(id)?.()
    watches.delete(id)
    presentations.delete(id)
  }
  const subscriptions = createLivePresentationSubscriptions(start, release)
  return {
    get: (id: TId): ResourceKnowledge<TPresentation> => {
      return presentations.get(id) ?? UNKNOWN_PRESENTATION
    },
    load: (id: TId) => {
      start(id)
    },
    subscribe: subscriptions.subscribe,
    dispose: () => {
      for (const dispose of watches.values()) dispose()
      watches.clear()
      subscriptions.clear()
      presentations.clear()
    },
  }
}
