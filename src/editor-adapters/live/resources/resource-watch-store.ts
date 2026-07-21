import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { ResourceSessionStore } from '@wizard-archive/editor/resources/session-store'

type ResourceWatchStoreOptions<TSnapshot> = Readonly<{
  initialLoad?: Readonly<{
    load(resourceId: ResourceId): Promise<TSnapshot>
    failed(resourceId: ResourceId): void
  }>
  releaseState?(resourceId: ResourceId): void
}>

export function createResourceSubscriptionRetainer(
  start: (resourceId: ResourceId) => () => void,
  released: (resourceId: ResourceId) => void,
) {
  const subscriptions = new Map<ResourceId, Readonly<{ count: number; stop(): void }>>()
  return {
    dispose(): void {
      for (const subscription of subscriptions.values()) subscription.stop()
      subscriptions.clear()
    },
    retain(resourceId: ResourceId): () => void {
      const current = subscriptions.get(resourceId)
      subscriptions.set(
        resourceId,
        current ? { ...current, count: current.count + 1 } : { count: 1, stop: start(resourceId) },
      )
      return () => {
        const retained = subscriptions.get(resourceId)
        if (!retained) return
        if (retained.count > 1) {
          subscriptions.set(resourceId, { ...retained, count: retained.count - 1 })
          return
        }
        subscriptions.delete(resourceId)
        retained.stop()
        released(resourceId)
      }
    },
  }
}

export function createResourceWatchStore<TSnapshot, TState>(
  watch: (resourceId: ResourceId, apply: (snapshot: TSnapshot) => void) => () => void,
  apply: (resourceId: ResourceId, snapshot: TSnapshot) => void,
  initialState: TState,
  options: ResourceWatchStoreOptions<TSnapshot> = {},
) {
  const source = new ResourceSessionStore(initialState)
  const watches = new Map<ResourceId, () => void>()
  const subscribers = new Map<ResourceId, number>()

  const ensure = (resourceId: ResourceId) => {
    if (watches.has(resourceId)) return
    let active = true
    let initialized = false
    const stop = watch(resourceId, (snapshot) => {
      initialized = true
      apply(resourceId, snapshot)
    })
    watches.set(resourceId, () => {
      active = false
      stop()
    })
    if (!options.initialLoad) return
    void options.initialLoad
      .load(resourceId)
      .then((snapshot) => {
        if (!active || initialized) return
        initialized = true
        apply(resourceId, snapshot)
      })
      .catch(() => {
        if (!active || initialized) return
        initialized = true
        options.initialLoad?.failed(resourceId)
      })
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
        options.releaseState?.(resourceId)
        source.set(resourceId, initialState)
      }
    },
  }
}
