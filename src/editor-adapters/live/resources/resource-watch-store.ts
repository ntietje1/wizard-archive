import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { ResourceSessionStore } from '@wizard-archive/editor/resources/session-store'

export function createResourceWatchStore<TSnapshot, TState>(
  watch: (resourceId: ResourceId, apply: (snapshot: TSnapshot) => void) => () => void,
  apply: (resourceId: ResourceId, snapshot: TSnapshot) => void,
  initialState: TState,
) {
  const source = new ResourceSessionStore(initialState)
  const watches = new Map<ResourceId, () => void>()
  const subscribers = new Map<ResourceId, number>()

  const ensure = (resourceId: ResourceId) => {
    if (watches.has(resourceId)) return
    watches.set(
      resourceId,
      watch(resourceId, (snapshot) => apply(resourceId, snapshot)),
    )
  }

  return {
    dispose: () => {
      for (const unsubscribe of watches.values()) unsubscribe()
      watches.clear()
      source.dispose()
    },
    get: (resourceId: ResourceId) => source.get(resourceId),
    set: (resourceId: ResourceId, state: TState) => {
      source.set(resourceId, state)
    },
    subscribe: (resourceId: ResourceId, listener: () => void) => {
      ensure(resourceId)
      subscribers.set(resourceId, (subscribers.get(resourceId) ?? 0) + 1)
      const unsubscribe = source.subscribe(resourceId, listener)
      let active = true
      return () => {
        if (!active) return
        active = false
        unsubscribe()
        const remaining = (subscribers.get(resourceId) ?? 1) - 1
        if (remaining > 0) {
          subscribers.set(resourceId, remaining)
          return
        }
        subscribers.delete(resourceId)
        watches.get(resourceId)?.()
        watches.delete(resourceId)
      }
    },
  }
}
