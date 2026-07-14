import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'

export function createResourceWatchStore<TSnapshot, TState>(
  watch: (resourceId: ResourceId, apply: (snapshot: TSnapshot) => void) => () => void,
  apply: (resourceId: ResourceId, snapshot: TSnapshot) => void,
) {
  const states = new Map<ResourceId, TState>()
  const listeners = new Map<ResourceId, Set<() => void>>()
  const watches = new Map<ResourceId, () => void>()

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
      listeners.clear()
    },
    get: (resourceId: ResourceId) => {
      ensure(resourceId)
      return states.get(resourceId)
    },
    set: (resourceId: ResourceId, state: TState) => {
      states.set(resourceId, state)
      for (const listener of listeners.get(resourceId) ?? []) listener()
    },
    subscribe: (resourceId: ResourceId, listener: () => void) => {
      ensure(resourceId)
      const resourceListeners = listeners.get(resourceId) ?? new Set()
      resourceListeners.add(listener)
      listeners.set(resourceId, resourceListeners)
      return () => resourceListeners.delete(listener)
    },
  }
}
